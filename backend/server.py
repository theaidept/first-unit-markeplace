from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import secrets
import re
import ipaddress
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from enum import Enum
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "First Unit")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="First Unit API")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class Role(str, Enum):
    member = "member"
    admin = "admin"


class ResponderType(str, Enum):
    law_enforcement = "law_enforcement"
    firefighter_career = "firefighter_career"
    firefighter_volunteer = "firefighter_volunteer"
    emt_paramedic = "emt_paramedic"
    dispatcher = "dispatcher"


class ServiceStatus(str, Enum):
    active = "active"
    retired = "retired"


class VerificationStatus(str, Enum):
    unverified = "unverified"
    pre_screen = "pre_screen"
    validating = "validating"
    human_review = "human_review"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


RESPONDER_LABELS = {
    "law_enforcement": "Law Enforcement — Sworn Officer",
    "firefighter_career": "Firefighter — Career",
    "firefighter_volunteer": "Firefighter — Volunteer",
    "emt_paramedic": "EMT / Paramedic",
    "dispatcher": "Dispatcher",
}


# ---------------------------------------------------------------------------
# Password + JWT helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Serializers — enforce separated identity layers (constraint 3)
# ---------------------------------------------------------------------------
def self_user(user: dict) -> dict:
    """The account's own view of itself (never leaks password hash)."""
    return {
        "id": user["id"],
        "email": user["email"],
        "phone": user.get("phone"),
        "role": user.get("role", "member"),
        "responder_type": user.get("responder_type"),
        "service_status": user.get("service_status"),
        "verification_status": user.get("verification_status", "unverified"),
        "paypal_ref": user.get("paypal_ref"),
        "venmo_handle": user.get("venmo_handle"),
        "created_at": user.get("created_at"),
    }


def public_profile(profile: dict) -> dict:
    """The layer other members are allowed to see. Undercover members hide photo/name."""
    undercover = profile.get("undercover", False)
    photo_visible = profile.get("photo_visibility", "visible") == "visible" and not undercover
    return {
        "id": profile["id"],
        "display_handle": profile.get("display_handle"),
        "avatar": profile.get("avatar") if photo_visible else None,
        "agency": profile.get("agency"),
        "rank": profile.get("rank"),
        "years_of_service": profile.get("years_of_service"),
        "verified_badge": profile.get("verified_badge", False),
        "undercover": undercover,
    }


# ---------------------------------------------------------------------------
# Auth dependencies + the permanent verified-only gate
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_verified(user: dict = Depends(get_current_user)) -> dict:
    """THE VERIFIED-ONLY GATE. Every marketplace/member feature depends on this."""
    if user.get("verification_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail="Your account is not verified. Access is limited to your verification status.",
        )
    return user


# ---------------------------------------------------------------------------
# Email (Resend via Emergent proxy) — password reset only in this phase
# ---------------------------------------------------------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        logger.error("EMERGENT_EMAIL_KEY not configured")
        raise HTTPException(status_code=500, detail="Email not configured")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


def reset_email_html(reset_link: str) -> str:
    return (
        f'<table role="presentation" width="100%" style="background:#f2f3f5;padding:32px 0">'
        f'<tr><td align="center"><table role="presentation" width="520" '
        f'style="background:#ffffff;border:1px solid #d9dce1;font-family:Arial,Helvetica,sans-serif">'
        f'<tr><td style="background:#0b1f42;padding:20px 28px;color:#ffffff;'
        f'font-size:18px;letter-spacing:2px;font-weight:bold">FIRST UNIT</td></tr>'
        f'<tr><td style="padding:28px">'
        f'<h1 style="font-size:20px;color:#12151b;margin:0 0 12px">Reset your password</h1>'
        f'<p style="font-size:14px;color:#50565f;line-height:1.6">We received a request to reset '
        f'your First Unit password. Tap the button below to choose a new one. This link expires in '
        f'one hour.</p>'
        f'<p style="margin:24px 0"><a href="{reset_link}" '
        f'style="background:#a6192e;color:#ffffff;text-decoration:none;padding:12px 24px;'
        f'font-size:14px;font-weight:bold;border-radius:2px;display:inline-block">Reset Password</a></p>'
        f'<p style="font-size:12px;color:#868c96;line-height:1.6">If you did not request this, you '
        f'can safely ignore this email. First Unit will never ask you for your password by email.</p>'
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;background:#f2f3f5;font-size:11px;color:#868c96">'
        f'Sent by First Unit — a verified marketplace for first responders.</td></tr>'
        f'</table></td></tr></table>'
    )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    phone: str = Field(min_length=7)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class ResetBody(BaseModel):
    token: str
    password: str = Field(min_length=8)


class SetVerificationBody(BaseModel):
    verification_status: VerificationStatus
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Brute force
# ---------------------------------------------------------------------------
async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")


async def record_failure(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    count = (rec.get("count", 0) if rec else 0) + 1
    update = {"count": count}
    if count >= 5:
        update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def clear_failures(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# ---------------------------------------------------------------------------
# Verification helpers
# ---------------------------------------------------------------------------
async def log_verification_event(verification_id: str, event: str, reviewer: str, status: str):
    await db.verification_events.insert_one({
        "id": str(uuid.uuid4()),
        "verification_id": verification_id,
        "timestamp": now_iso(),
        "event": event,
        "reviewer": reviewer,
        "status": status,
    })


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "phone": body.phone.strip(),
        "role": "member",
        "responder_type": None,
        "service_status": None,
        "verification_status": "unverified",
        "paypal_ref": None,
        "venmo_handle": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)

    # Public profile layer — separated from verified identity (constraint 3)
    profile_doc = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "display_handle": email.split("@")[0],
        "avatar": None,
        "agency": None,
        "rank": None,
        "years_of_service": None,
        "verified_badge": False,
        "photo_visibility": "visible",
        "undercover": False,
        "created_at": now_iso(),
    }
    await db.profiles.insert_one(profile_doc)

    # Verification record — NO raw credential documents ever stored (constraint 2)
    vid = str(uuid.uuid4())
    await db.verification_records.insert_one({
        "id": vid,
        "user_id": uid,
        "current_state": "unverified",
        "provider": None,
        "provider_reference": None,
        "outcome": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await log_verification_event(vid, "Account created", "System", "Received")

    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return self_user(user_doc)


@api.post("/auth/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await check_lockout(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failure(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_failures(identifier)
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return self_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "ok"}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return self_user(user)


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=3600, path="/")
    return {"status": "ok"}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotBody):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always respond success to avoid account enumeration.
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "token": token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "used": False,
            "created_at": now_iso(),
        })
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        try:
            await send_email(to=email, subject="Reset your First Unit password",
                             html=reset_email_html(reset_link))
        except Exception as e:
            logger.error(f"reset email failed: {e}")
    return {"status": "ok", "message": "If that account exists, a reset link has been sent."}


@api.post("/auth/reset-password")
async def reset_password(body: ResetBody):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link has expired")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"status": "ok", "message": "Password updated. You can now sign in."}


# ---------------------------------------------------------------------------
# Verification (own status — allowed even when unverified)
# ---------------------------------------------------------------------------
@api.get("/verification/me")
async def my_verification(user: dict = Depends(get_current_user)):
    rec = await db.verification_records.find_one({"user_id": user["id"]}, {"_id": 0})
    events = await db.verification_events.find(
        {"verification_id": rec["id"]}, {"_id": 0}
    ).sort("timestamp", 1).to_list(200) if rec else []
    return {
        "verification_status": user.get("verification_status", "unverified"),
        "record": rec,
        "events": events,
    }


# ---------------------------------------------------------------------------
# Marketplace shell — behind the permanent verified-only gate
# ---------------------------------------------------------------------------
@api.get("/marketplace/summary")
async def marketplace_summary(user: dict = Depends(require_verified)):
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    return {
        "handle": public_profile(profile)["display_handle"] if profile else None,
        "listings": [],
        "stories": [],
        "message": "Marketplace coming online. Listings arrive in the next phase.",
    }


@api.get("/members")
async def members(user: dict = Depends(require_verified)):
    return {"members": []}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@api.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return {"users": users}


@api.post("/admin/users/{user_id}/verification-status")
async def admin_set_verification(user_id: str, body: SetVerificationBody,
                                 admin: dict = Depends(require_admin)):
    """TEMPORARY internal control so later phases can be built/tested before ID.me lands."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = body.verification_status.value
    await db.users.update_one({"id": user_id}, {"$set": {"verification_status": new_status}})

    rec = await db.verification_records.find_one({"user_id": user_id})
    if rec:
        await db.verification_records.update_one(
            {"user_id": user_id},
            {"$set": {"current_state": new_status, "updated_at": now_iso(),
                      "outcome": new_status if new_status in ("approved", "rejected") else rec.get("outcome")}},
        )
        await db.profiles.update_one({"user_id": user_id},
                                     {"$set": {"verified_badge": new_status == "approved"}})
        await log_verification_event(
            rec["id"],
            f"Status set to {new_status.replace('_', ' ')}",
            "Trust & Safety Team",
            new_status.replace("_", " ").title(),
        )
    await db.admin_actions.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "set_verification_status",
        "target_type": "user",
        "target_id": user_id,
        "detail": {"status": new_status, "note": body.note},
        "timestamp": now_iso(),
    })
    return {"status": "ok", "verification_status": new_status}


@api.get("/")
async def root():
    return {"service": "First Unit API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
async def seed_admins():
    admins = [
        (os.environ.get("OWNER_EMAIL"), os.environ.get("OWNER_PASSWORD"), "First Unit Owner"),
        (os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD"), "First Unit Admin"),
    ]
    for email, password, handle in admins:
        if not email or not password:
            continue
        email = email.lower().strip()
        existing = await db.users.find_one({"email": email})
        if existing is None:
            uid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": uid,
                "email": email,
                "password_hash": hash_password(password),
                "phone": None,
                "role": "admin",
                "responder_type": None,
                "service_status": None,
                "verification_status": "approved",
                "paypal_ref": None,
                "venmo_handle": None,
                "created_at": now_iso(),
            })
            await db.profiles.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "display_handle": handle,
                "avatar": None, "agency": "First Unit", "rank": "Administrator",
                "years_of_service": None, "verified_badge": True,
                "photo_visibility": "visible", "undercover": False, "created_at": now_iso(),
            })
        elif not verify_password(password, existing["password_hash"]):
            await db.users.update_one({"email": email},
                                      {"$set": {"password_hash": hash_password(password),
                                                "role": "admin", "verification_status": "approved"}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("token")
    await db.login_attempts.create_index("identifier")
    await db.verification_events.create_index("verification_id")
    await db.profiles.create_index("user_id")
    await seed_admins()
    logger.info("First Unit API started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
