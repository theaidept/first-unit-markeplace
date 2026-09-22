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
from urllib.parse import urlparse, quote

import jwt
import bcrypt
import httpx
import asyncio
import requests
import stripe
from providers import get_provider, pkce_pair
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Query, Header
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


def _initials(handle: str) -> str:
    parts = [p for p in re.split(r"\s+", (handle or "").strip()) if p]
    if not parts:
        return "FU"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def public_profile(profile: dict, user: dict = None) -> dict:
    """Member-facing PUBLIC layer only (constraint 3).

    NEVER includes verified-identity fields (real name, credential number,
    provider reference). Undercover members show no photo and no real name
    while still carrying a confirmed Verified badge.
    """
    pv = profile.get("photo_visibility", "avatar")
    if pv == "visible":  # legacy normalization
        pv = "photo"
    undercover = profile.get("undercover", False)
    show_photo = pv == "photo" and bool(profile.get("avatar")) and not undercover
    u = user or {}
    return {
        "id": profile.get("id"),
        "user_id": profile.get("user_id"),
        "display_handle": profile.get("display_handle"),
        "photo_visibility": pv,
        "avatar": profile.get("avatar") if show_photo else None,
        "initials": _initials(profile.get("display_handle")),
        "agency": profile.get("agency"),
        "rank": profile.get("rank"),
        "years_of_service": profile.get("years_of_service"),
        "verified_badge": profile.get("verified_badge", False),
        "undercover": undercover,
        "responder_type": u.get("responder_type"),
        "service_status": u.get("service_status"),
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
# SMS (Twilio) + status-alert notifications
# ---------------------------------------------------------------------------
async def send_sms(to: str, body: str) -> Optional[str]:
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    frm = os.environ.get("TWILIO_FROM_NUMBER", "")
    if not (sid and token and frm):
        logger.info(f"[SMS mock] to={to}: {body}")
        return None
    num = (to or "").strip()
    if not num.startswith("+"):
        digits = re.sub(r"\D", "", num)
        num = "+1" + digits if len(digits) == 10 else "+" + digits
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"From": frm, "To": num, "Body": body},
                auth=(sid, token),
            )
        r.raise_for_status()
        return r.json().get("sid")
    except Exception as e:
        logger.error(f"SMS send failed: {e}")
        return None


ALERT_COPY = {
    "submitted": ("First Unit — verification received",
                  "Your First Unit verification application was received. We're checking your service now."),
    "review": ("First Unit — manual review in progress",
               "Your First Unit verification is in manual review by our Trust & Safety team. We'll notify you soon."),
    "approved": ("First Unit — you're verified",
                 "You're verified. Welcome to First Unit — the marketplace is now unlocked."),
    "rejected": ("First Unit — verification not approved",
                 "We couldn't verify your first-responder status. Reply to this email to appeal."),
}


def alert_email_html(line: str) -> str:
    link = f"{FRONTEND_URL}/verification"
    return (
        f'<table role="presentation" width="100%" style="background:#f2f3f5;padding:32px 0">'
        f'<tr><td align="center"><table role="presentation" width="520" '
        f'style="background:#ffffff;border:1px solid #d9dce1;font-family:Arial,Helvetica,sans-serif">'
        f'<tr><td style="background:#0b1f42;padding:20px 28px;color:#ffffff;font-size:18px;'
        f'letter-spacing:2px;font-weight:bold">FIRST UNIT</td></tr>'
        f'<tr><td style="padding:28px">'
        f'<h1 style="font-size:19px;color:#12151b;margin:0 0 12px">Verification update</h1>'
        f'<p style="font-size:14px;color:#50565f;line-height:1.6">{escape(line)}</p>'
        f'<p style="margin:22px 0"><a href="{link}" style="background:#a6192e;color:#ffffff;'
        f'text-decoration:none;padding:12px 24px;font-size:14px;font-weight:bold;border-radius:2px;'
        f'display:inline-block">View your status</a></p>'
        f'<p style="font-size:12px;color:#868c96">First Unit will never ask you for your password '
        f'or credential documents by email.</p></td></tr>'
        f'<tr><td style="padding:16px 28px;background:#f2f3f5;font-size:11px;color:#868c96">'
        f'Sent by First Unit — a verified marketplace for first responders.</td></tr>'
        f'</table></td></tr></table>'
    )


async def notify(user: dict, event_type: str):
    subject, line = ALERT_COPY.get(event_type, (None, None))
    if not subject:
        return
    if user.get("email"):
        try:
            await send_email(to=user["email"], subject=subject, html=alert_email_html(line))
        except Exception as e:
            logger.error(f"alert email failed: {e}")
    if user.get("phone"):
        try:
            await send_sms(user["phone"], f"First Unit: {line}")
        except Exception as e:
            logger.error(f"alert sms failed: {e}")


# ---------------------------------------------------------------------------
# Verification state helpers + provider result application
# ---------------------------------------------------------------------------
async def set_verification_state(user_id, status, vid, provider_name=None,
                                 provider_ref=None, outcome=None):
    await db.users.update_one({"id": user_id}, {"$set": {"verification_status": status}})
    upd = {"current_state": status, "updated_at": now_iso()}
    if provider_name is not None:
        upd["provider"] = provider_name
    if provider_ref is not None:
        upd["provider_reference"] = provider_ref
    if outcome is not None:
        upd["outcome"] = outcome
    await db.verification_records.update_one({"id": vid}, {"$set": upd})
    await db.profiles.update_one({"user_id": user_id},
                                 {"$set": {"verified_badge": status == "approved"}})


async def apply_provider_result(user: dict, vid: str, result) -> dict:
    uid = user["id"]
    if result.outcome == "pass":
        await log_verification_event(vid, "ID.me database match", "ID.me Gateway", "Matched")
        await set_verification_state(uid, "approved", vid, result.provider,
                                     result.provider_reference, "approved")
        await log_verification_event(vid, "Account activation", "System", "Approved")
        await notify(user, "approved")
        return {"mode": "result", "verification_status": "approved"}
    if result.outcome == "review":
        await log_verification_event(vid, "ID.me database check inconclusive", "ID.me Gateway", "In review")
        await set_verification_state(uid, "human_review", vid, result.provider,
                                     result.provider_reference, None)
        await log_verification_event(vid, "Routed to manual review", "Trust & Safety Team", "In review")
        await notify(user, "review")
        return {"mode": "result", "verification_status": "human_review"}
    await log_verification_event(vid, "ID.me credential check failed", "ID.me Gateway", "Rejected")
    await set_verification_state(uid, "rejected", vid, result.provider,
                                 result.provider_reference, "rejected")
    await notify(user, "rejected")
    return {"mode": "result", "verification_status": "rejected"}


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


class PrescreenBody(BaseModel):
    responder_type: ResponderType
    service_status: ServiceStatus
    agency: str = Field(min_length=1)
    credential_number: str = Field(default="")
    rank: Optional[str] = None
    years_of_service: Optional[str] = None


class DecisionBody(BaseModel):
    decision: str  # "approve" | "reject"
    reason: Optional[str] = None


class ProfileUpdateBody(BaseModel):
    display_handle: Optional[str] = None
    agency: Optional[str] = None
    rank: Optional[str] = None
    years_of_service: Optional[str] = None
    photo_visibility: Optional[str] = None  # photo | avatar | initials
    undercover: Optional[bool] = None
    avatar: Optional[str] = None


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
        "photo_visibility": "avatar",
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
    users = await db.users.find(
        {"role": "member", "verification_status": "approved"},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(1000)
    out = []
    for u in users:
        profile = await db.profiles.find_one({"user_id": u["id"]}, {"_id": 0})
        if profile:
            out.append(public_profile(profile, u))
    return {"members": out}


@api.get("/profile/me")
async def get_my_profile(user: dict = Depends(require_verified)):
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    pub = public_profile(profile, user)
    # Own view may manage the stored photo even while it's publicly hidden.
    pub["avatar_raw"] = profile.get("avatar")
    return pub


@api.put("/profile/me")
async def update_my_profile(body: ProfileUpdateBody, user: dict = Depends(require_verified)):
    updates = {}
    if body.display_handle is not None:
        handle = body.display_handle.strip()
        if not handle:
            raise HTTPException(status_code=400, detail="Display handle cannot be empty")
        updates["display_handle"] = handle
    if body.agency is not None:
        updates["agency"] = body.agency.strip() or None
    if body.rank is not None:
        updates["rank"] = body.rank.strip() or None
    if body.years_of_service is not None:
        updates["years_of_service"] = body.years_of_service.strip() or None
    if body.photo_visibility is not None:
        if body.photo_visibility not in ("photo", "avatar", "initials"):
            raise HTTPException(status_code=400, detail="Invalid photo visibility")
        updates["photo_visibility"] = body.photo_visibility
    if body.undercover is not None:
        updates["undercover"] = bool(body.undercover)
    if body.avatar is not None:
        updates["avatar"] = body.avatar.strip() or None
    if updates:
        await db.profiles.update_one({"user_id": user["id"]}, {"$set": updates})
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    pub = public_profile(profile, user)
    pub["avatar_raw"] = profile.get("avatar")
    return pub


@api.get("/profiles/{user_id}")
async def get_profile(user_id: str, user: dict = Depends(require_verified)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target or target.get("verification_status") != "approved":
        raise HTTPException(status_code=404, detail="Member not found")
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Member not found")
    return public_profile(profile, target)


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
    """Deliberate manual override — requires a reason and is fully audited (not an open backdoor)."""
    if not (body.note or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required for a manual verification override")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = body.verification_status.value
    prev_status = user.get("verification_status")
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
            f"Manual override to {new_status.replace('_', ' ')}: {body.note.strip()}",
            f"Admin override ({admin['email']})",
            new_status.replace("_", " ").title(),
        )
    await audit(admin, "manual_verification_override", "user", user_id,
                {"from": prev_status, "to": new_status, "reason": body.note.strip()})
    return {"status": "ok", "verification_status": new_status}


@api.get("/verification/config")
async def verification_config(user: dict = Depends(get_current_user)):
    provider = get_provider()
    return {"provider": provider.name, "oauth": provider.is_oauth_configured()}


@api.post("/verification/submit")
async def verification_submit(body: PrescreenBody, user: dict = Depends(get_current_user)):
    if user.get("verification_status") == "approved":
        raise HTTPException(status_code=400, detail="Your account is already verified")
    uid = user["id"]
    provider = get_provider()
    prescreen = {
        "responder_type": body.responder_type.value,
        "service_status": body.service_status.value,
        "agency": body.agency.strip(),
        "credential_number": body.credential_number.strip(),
        "rank": (body.rank or "").strip() or None,
        "years_of_service": (body.years_of_service or "").strip() or None,
    }
    # Persist member-entered fields (NOT documents) + set identity fields on the user.
    await db.users.update_one({"id": uid}, {"$set": {
        "responder_type": prescreen["responder_type"],
        "service_status": prescreen["service_status"],
    }})
    rec = await db.verification_records.find_one({"user_id": uid})
    vid = rec["id"]
    await db.verification_records.update_one({"id": vid}, {"$set": {
        "prescreen": prescreen, "provider": provider.name,
        "current_state": "pre_screen", "updated_at": now_iso(),
    }})
    await db.users.update_one({"id": uid}, {"$set": {"verification_status": "pre_screen"}})
    await log_verification_event(vid, "Application submitted", "System", "Received")
    await notify(user, "submitted")

    # Step 2 — credential validation
    await set_verification_state(uid, "validating", vid, provider.name)

    if provider.is_oauth_configured():
        state = secrets.token_urlsafe(24)
        verifier, challenge = pkce_pair()
        await db.oauth_states.insert_one({
            "state": state, "verifier": verifier, "user_id": uid,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        })
        await log_verification_event(vid, "Redirected to ID.me for validation", "ID.me Gateway", "Pending")
        return {"mode": "redirect", "authorize_url": provider.authorize_url(state, challenge)}

    # Mock mode — deterministic outcome so the flow is fully testable now.
    result = provider.evaluate_mock(prescreen)
    return await apply_provider_result(user, vid, result)


@api.get("/verification/idme/callback")
async def idme_callback(code: str, state: str, user: dict = Depends(get_current_user)):
    st = await db.oauth_states.find_one({"state": state, "user_id": user["id"]})
    if not st:
        raise HTTPException(status_code=400, detail="Invalid or expired verification state")
    provider = get_provider()
    try:
        result = await provider.evaluate_callback(code, st["verifier"])
    except Exception as e:
        logger.error(f"idme callback failed: {e}")
        raise HTTPException(status_code=502, detail="Verification provider error")
    await db.oauth_states.delete_one({"state": state})
    rec = await db.verification_records.find_one({"user_id": user["id"]})
    return await apply_provider_result(user, rec["id"], result)


# ---------------------------------------------------------------------------
# Admin — verification review queue
# ---------------------------------------------------------------------------
@api.get("/admin/verification-queue")
async def admin_verification_queue(admin: dict = Depends(require_admin)):
    recs = await db.verification_records.find(
        {"current_state": "human_review"}, {"_id": 0}
    ).sort("updated_at", 1).to_list(500)
    out = []
    for rec in recs:
        u = await db.users.find_one({"id": rec["user_id"]}, {"_id": 0, "password_hash": 0})
        if not u:
            continue
        out.append({
            "user_id": rec["user_id"],
            "email": u["email"],
            "phone": u.get("phone"),
            "provider": rec.get("provider"),
            "outcome": rec.get("outcome"),
            "provider_reference": rec.get("provider_reference"),
            "prescreen": rec.get("prescreen"),
            "updated_at": rec.get("updated_at"),
        })
    return {"queue": out}


@api.post("/admin/verification/{user_id}/decision")
async def admin_verification_decision(user_id: str, body: DecisionBody,
                                      admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    rec = await db.verification_records.find_one({"user_id": user_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Verification record not found")
    vid = rec["id"]
    reviewer = admin["email"]
    if body.decision == "approve":
        await log_verification_event(vid, "Agency confirmation approved", reviewer, "Approved")
        await set_verification_state(user_id, "approved", vid, outcome="approved")
        await log_verification_event(vid, "Account activation", "System", "Approved")
        await notify(user, "approved")
        final = "approved"
    elif body.decision == "reject":
        reason = (body.reason or "No reason provided").strip()
        await log_verification_event(vid, f"Rejected in review: {reason}", reviewer, "Rejected")
        await set_verification_state(user_id, "rejected", vid, outcome="rejected")
        await notify(user, "rejected")
        final = "rejected"
    else:
        raise HTTPException(status_code=400, detail="decision must be 'approve' or 'reject'")
    await db.admin_actions.insert_one({
        "id": str(uuid.uuid4()), "admin_id": admin["id"], "action": f"verification_{body.decision}",
        "target_type": "user", "target_id": user_id,
        "detail": {"reason": body.reason}, "timestamp": now_iso(),
    })
    return {"status": "ok", "verification_status": final}


# ---------------------------------------------------------------------------
# Object storage (Emergent-managed) for listing photos
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "first-unit"
_storage_key = None

IMAGE_MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
VIDEO_MIME = {"mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm", "m4v": "video/x-m4v"}


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Category restriction + blocked-keyword enforcement (constraint 4)
# ---------------------------------------------------------------------------
BLOCKED_KEYWORDS = [
    "firearm", "firearms", "gun", "guns", "handgun", "pistol", "revolver", "rifle",
    "shotgun", "glock", "ar-15", "ar15", "ak-47", "ak47", "ammo", "ammunition",
    "bullet", "bullets", "silencer", "suppressor", "magazine clip",
    "knife", "knives", "blade", "dagger", "switchblade", "machete", "bayonet",
    "karambit", "katana", "sword", "cleaver",
]
_BLOCKED_RE = re.compile(r"|".join(rf"\b{re.escape(k)}\b" for k in BLOCKED_KEYWORDS), re.I)

ALLOWED_CATEGORIES = [
    {"name": "Gear & Equipment", "slug": "gear"},
    {"name": "Vehicles", "slug": "vehicles"},
    {"name": "Art & Personal Items", "slug": "art"},
]
RESTRICTED_CATEGORIES = [
    {"name": "Firearms", "slug": "firearms",
     "blocked_keywords": ["gun", "firearm", "pistol", "rifle", "shotgun", "ammo"]},
    {"name": "Edged Weapons", "slug": "edged-weapons",
     "blocked_keywords": ["knife", "blade", "dagger", "sword", "machete"]},
]
CONDITIONS = {"Excellent", "Good", "Fair"}


def scan_blocked(*texts) -> Optional[str]:
    blob = " ".join(t for t in texts if t)
    m = _BLOCKED_RE.search(blob)
    return m.group(0) if m else None


async def seed_categories():
    for i, c in enumerate(ALLOWED_CATEGORIES):
        await db.categories.update_one({"slug": c["slug"]}, {"$setOnInsert": {
            "id": str(uuid.uuid4()), "name": c["name"], "slug": c["slug"],
            "is_restricted": False, "blocked_keywords": [], "active": True, "order": i,
            "created_at": now_iso(),
        }}, upsert=True)
    for c in RESTRICTED_CATEGORIES:
        await db.categories.update_one({"slug": c["slug"]}, {"$setOnInsert": {
            "id": str(uuid.uuid4()), "name": c["name"], "slug": c["slug"],
            "is_restricted": True, "blocked_keywords": c["blocked_keywords"],
            "active": False, "order": 99, "created_at": now_iso(),
        }}, upsert=True)


# ---------------------------------------------------------------------------
# Listing / Offer models + serializers
# ---------------------------------------------------------------------------
class ListingBody(BaseModel):
    title: str = Field(min_length=1)
    category: str
    condition: str
    location: str = ""
    description: str = ""
    price: float = Field(ge=0)
    photos: List[str] = []
    video: Optional[str] = None
    meetup_note: Optional[str] = None
    publish: bool = False  # True => go live (runs enforcement), False => save as draft


class OfferBody(BaseModel):
    amount: float = Field(gt=0)


async def seller_public(seller_id: str) -> dict:
    profile = await db.profiles.find_one({"user_id": seller_id}, {"_id": 0})
    user = await db.users.find_one({"id": seller_id}, {"_id": 0, "password_hash": 0})
    if not profile:
        return {"user_id": seller_id, "display_handle": "Member", "verified_badge": False}
    return public_profile(profile, user)


def _featured_active(listing: dict) -> bool:
    """A listing is FEATURED only while a paid boost is live (constraint 6 / Lane B)."""
    if not listing.get("featured"):
        return False
    fu = listing.get("featured_until")
    if fu is None:  # 'Until sold' boost — stays featured until the listing sells
        return True
    try:
        return datetime.fromisoformat(fu) > datetime.now(timezone.utc)
    except Exception:
        return False


async def listing_public(listing: dict, with_seller: bool = True) -> dict:
    out = {
        "id": listing["id"],
        "seller_id": listing["seller_id"],
        "title": listing["title"],
        "category": listing["category"],
        "condition": listing.get("condition"),
        "location": listing.get("location"),
        "description": listing.get("description"),
        "price": listing.get("price"),
        "photos": listing.get("photos", []),
        "video": listing.get("video"),
        "status": listing.get("status"),
        "meetup_note": listing.get("meetup_note"),
        "has_video": bool(listing.get("video")),
        "featured": _featured_active(listing),
        "created_at": listing.get("created_at"),
    }
    if with_seller:
        out["seller"] = await seller_public(listing["seller_id"])
    return out


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@api.get("/categories")
async def list_categories(user: dict = Depends(require_verified)):
    cats = await db.categories.find(
        {"active": True, "is_restricted": False}, {"_id": 0}
    ).sort("order", 1).to_list(100)
    return {"categories": cats}


# ---------------------------------------------------------------------------
# Listings
# ---------------------------------------------------------------------------
async def _validate_category(slug: str):
    cat = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=400, detail="Unknown category")
    if cat.get("is_restricted") or not cat.get("active"):
        raise HTTPException(status_code=400, detail="This category is restricted and cannot be used")
    return cat


@api.post("/upload")
async def upload_photo(file: UploadFile = File(...), user: dict = Depends(require_verified)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "").lower()
    if ext not in IMAGE_MIME:
        raise HTTPException(status_code=400, detail="Only JPG, PNG or WEBP images are allowed")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, IMAGE_MIME[ext])
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(status_code=502, detail="Upload failed, please try again")
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"],
        "original_filename": file.filename, "content_type": IMAGE_MIME[ext],
        "size": result.get("size"), "owner_id": user["id"], "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@api.get("/files/{path:path}")
async def serve_file(path: str, user: dict = Depends(require_verified)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, ctype = await asyncio.to_thread(get_object, path)
    except Exception as e:
        logger.error(f"file fetch failed: {e}")
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type=record.get("content_type", ctype),
                    headers={"Cache-Control": "private, max-age=3600"})


@api.post("/listings")
async def create_listing(body: ListingBody, user: dict = Depends(require_verified)):
    await _validate_category(body.category)
    if body.condition not in CONDITIONS:
        raise HTTPException(status_code=400, detail="Invalid condition")
    lid = str(uuid.uuid4())
    status = "draft"
    flagged_term = None
    if body.publish:
        if not body.photos:
            raise HTTPException(status_code=400, detail="Add at least one photo to publish")
        flagged_term = scan_blocked(body.title, body.description)
        status = "flagged" if flagged_term else "live"
    doc = {
        "id": lid, "seller_id": user["id"], "title": body.title.strip(),
        "category": body.category, "condition": body.condition,
        "location": body.location.strip(), "description": body.description.strip(),
        "price": float(body.price), "photos": body.photos, "video": body.video,
        "meetup_note": (body.meetup_note or "").strip() or None,
        "status": status, "featured": False,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.listings.insert_one(doc)
    await sync_story(doc)
    if flagged_term:
        await db.reports.insert_one({
            "id": str(uuid.uuid4()), "reporter": "System", "target_type": "listing",
            "target_id": lid, "reason": f"Blocked keyword at creation: '{flagged_term}'",
            "status": "open", "reviewer": None, "created_at": now_iso(),
        })
    result = await listing_public(doc, with_seller=False)
    result["flagged_reason"] = (f"Contains a prohibited term ('{flagged_term}'). "
                                "Sent to Trust & Safety review.") if flagged_term else None
    return result


@api.put("/listings/{listing_id}")
async def update_listing(listing_id: str, body: ListingBody, user: dict = Depends(require_verified)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["seller_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your listing")
    await _validate_category(body.category)
    if body.condition not in CONDITIONS:
        raise HTTPException(status_code=400, detail="Invalid condition")
    status = listing["status"]
    flagged_term = None
    if body.publish:
        if not body.photos:
            raise HTTPException(status_code=400, detail="Add at least one photo to publish")
        flagged_term = scan_blocked(body.title, body.description)
        status = "flagged" if flagged_term else "live"
    updates = {
        "title": body.title.strip(), "category": body.category, "condition": body.condition,
        "location": body.location.strip(), "description": body.description.strip(),
        "price": float(body.price), "photos": body.photos, "video": body.video,
        "meetup_note": (body.meetup_note or "").strip() or None,
        "status": status, "updated_at": now_iso(),
    }
    await db.listings.update_one({"id": listing_id}, {"$set": updates})
    listing.update(updates)
    await sync_story(listing)
    if flagged_term:
        await db.reports.insert_one({
            "id": str(uuid.uuid4()), "reporter": "System", "target_type": "listing",
            "target_id": listing_id, "reason": f"Blocked keyword at publish: '{flagged_term}'",
            "status": "open", "reviewer": None, "created_at": now_iso(),
        })
    listing.update(updates)
    result = await listing_public(listing, with_seller=False)
    result["flagged_reason"] = (f"Contains a prohibited term ('{flagged_term}'). "
                                "Sent to Trust & Safety review.") if flagged_term else None
    return result


@api.get("/listings/mine")
async def my_listings(user: dict = Depends(require_verified)):
    docs = await db.listings.find(
        {"seller_id": user["id"], "status": {"$ne": "removed"}}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"listings": [await listing_public(d) for d in docs]}


@api.get("/listings")
async def feed(user: dict = Depends(require_verified),
               q: Optional[str] = Query(None), category: Optional[str] = Query(None),
               featured: Optional[bool] = Query(None), has_video: Optional[bool] = Query(None)):
    query = {"status": "live"}
    if category and category != "all":
        query["category"] = category
    if has_video:
        query["video"] = {"$ne": None}
    if q:
        query["$or"] = [
            {"title": {"$regex": re.escape(q), "$options": "i"}},
            {"description": {"$regex": re.escape(q), "$options": "i"}},
        ]
    docs = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    if featured:
        docs = [d for d in docs if _featured_active(d)]
    # Featured (paid-boost) listings surface first, then newest.
    docs.sort(key=lambda d: (0 if _featured_active(d) else 1, ))
    return {"listings": [await listing_public(d) for d in docs]}


@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str, user: dict = Depends(require_verified)):
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    is_owner = listing["seller_id"] == user["id"]
    if listing["status"] not in ("live", "sold") and not is_owner:
        raise HTTPException(status_code=404, detail="Listing not found")
    out = await listing_public(listing)
    out["is_owner"] = is_owner
    return out


# ---------------------------------------------------------------------------
# Offers
# ---------------------------------------------------------------------------
async def _offer_public(o: dict, include_buyer=False):
    out = {
        "id": o["id"], "listing_id": o["listing_id"], "buyer_id": o["buyer_id"],
        "amount": o["amount"], "status": o["status"], "is_buy_now": o.get("is_buy_now", False),
        "created_at": o.get("created_at"),
    }
    if include_buyer:
        out["buyer"] = await seller_public(o["buyer_id"])
    return out


async def _create_offer(listing_id, user, amount, is_buy_now):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing or listing["status"] != "live":
        raise HTTPException(status_code=404, detail="Listing not available")
    if listing["seller_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot make an offer on your own listing")
    doc = {
        "id": str(uuid.uuid4()), "listing_id": listing_id, "buyer_id": user["id"],
        "amount": float(amount), "status": "pending", "is_buy_now": is_buy_now,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.offers.insert_one(doc)
    return await _offer_public(doc)


@api.post("/listings/{listing_id}/offers")
async def make_offer(listing_id: str, body: OfferBody, user: dict = Depends(require_verified)):
    return await _create_offer(listing_id, user, body.amount, False)


@api.post("/listings/{listing_id}/buy-now")
async def buy_now(listing_id: str, user: dict = Depends(require_verified)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing or listing["status"] != "live":
        raise HTTPException(status_code=404, detail="Listing not available")
    if listing["seller_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot buy your own listing")
    tx = await create_transaction(listing, user["id"], listing["price"])
    return {"status": "ok", "transaction_id": tx["id"]}


@api.get("/listings/{listing_id}/offers")
async def listing_offers(listing_id: str, user: dict = Depends(require_verified)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    is_owner = listing["seller_id"] == user["id"]
    if is_owner:
        offers = await db.offers.find({"listing_id": listing_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
        return {"offers": [await _offer_public(o, include_buyer=True) for o in offers], "is_owner": True}
    offers = await db.offers.find({"listing_id": listing_id, "buyer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"offers": [await _offer_public(o) for o in offers], "is_owner": False}


@api.post("/offers/{offer_id}/{action}")
async def act_on_offer(offer_id: str, action: str, user: dict = Depends(require_verified)):
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    listing = await db.listings.find_one({"id": offer["listing_id"]})
    if action in ("accept", "decline"):
        if not listing or listing["seller_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the seller can do that")
        if offer["status"] != "pending":
            raise HTTPException(status_code=400, detail="Offer is no longer pending")
        new_status = "accepted" if action == "accept" else "declined"
    elif action == "withdraw":
        if offer["buyer_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the buyer can withdraw")
        if offer["status"] != "pending":
            raise HTTPException(status_code=400, detail="Offer is no longer pending")
        new_status = "withdrawn"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    await db.offers.update_one({"id": offer_id}, {"$set": {"status": new_status, "updated_at": now_iso()}})
    tx_id = None
    if new_status == "accepted" and listing:
        tx = await create_transaction(listing, offer["buyer_id"], offer["amount"])
        tx_id = tx["id"]
    return {"status": "ok", "offer_status": new_status, "transaction_id": tx_id}


# ---------------------------------------------------------------------------
# LANE A — off-platform peer-to-peer payment facilitation (constraint 6)
# First Unit NEVER holds funds. No wallet, no escrow, no balance. We store only
# a reference to direct a payment to the member, and record the agreement.
# ---------------------------------------------------------------------------
PAYPAL_OAUTH = bool(os.environ.get("PAYPAL_CLIENT_ID") and os.environ.get("PAYPAL_SECRET"))


class PaymentLinkBody(BaseModel):
    paypal_me: Optional[str] = None
    paypal_email: Optional[str] = None
    venmo_handle: Optional[str] = None


class FeeConfigBody(BaseModel):
    amount: float = Field(ge=0)
    active: bool = False


def _clean_handle(h: str) -> str:
    return (h or "").strip().lstrip("@").strip("/").split("/")[-1]


def payment_status(u: dict) -> dict:
    return {
        "paypal_connected": bool(u.get("paypal_me") or u.get("paypal_email") or u.get("paypal_ref")),
        "paypal_me": u.get("paypal_me"),
        "paypal_email": u.get("paypal_email"),
        "venmo_handle": u.get("venmo_handle"),
        "oauth_available": PAYPAL_OAUTH,
    }


def pay_targets(seller: dict, amount) -> list:
    targets = []
    amt = f"{float(amount):.2f}"
    if seller.get("paypal_me"):
        h = _clean_handle(seller["paypal_me"])
        targets.append({"method": "paypal", "label": "PayPal.me", "handle": f"@{h}",
                        "url": f"https://www.paypal.com/paypalme/{quote(h)}/{amt}"})
    elif seller.get("paypal_email"):
        targets.append({"method": "paypal", "label": "PayPal", "handle": seller["paypal_email"],
                        "url": "https://www.paypal.com/myaccount/transfer/homepage/pay",
                        "note": f"Send to {seller['paypal_email']} in PayPal"})
    if seller.get("venmo_handle"):
        h = _clean_handle(seller["venmo_handle"])
        targets.append({"method": "venmo", "label": "Venmo", "handle": f"@{h}",
                        "url": f"https://venmo.com/{quote(h)}?txn=pay&amount={amt}&note=First%20Unit%20sale"})
    return targets


@api.get("/payments/me")
async def get_payments(user: dict = Depends(require_verified)):
    return payment_status(user)


@api.put("/payments/me")
async def set_payments(body: PaymentLinkBody, user: dict = Depends(require_verified)):
    updates = {}
    if body.paypal_me is not None:
        updates["paypal_me"] = _clean_handle(body.paypal_me) or None
    if body.paypal_email is not None:
        updates["paypal_email"] = body.paypal_email.strip() or None
    if body.venmo_handle is not None:
        updates["venmo_handle"] = _clean_handle(body.venmo_handle) or None
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return payment_status(fresh)


@api.post("/payments/paypal/start")
async def paypal_start(user: dict = Depends(require_verified)):
    if PAYPAL_OAUTH:
        cid = os.environ["PAYPAL_CLIENT_ID"]
        redirect = f"{FRONTEND_URL}/settings/paypal/callback"
        url = ("https://www.sandbox.paypal.com/connect?flowEntry=static"
               f"&client_id={cid}&scope=openid%20email&redirect_uri={redirect}&response_type=code")
        return {"mode": "redirect", "url": url}
    return {"mode": "manual", "message": "Add your PayPal.me handle below to receive payments."}


# --------------------------- Transactions (handoff) ---------------------------
async def create_transaction(listing: dict, buyer_id: str, amount: float, method: str = "pending"):
    existing = await db.transactions.find_one({"listing_id": listing["id"], "status": "agreed"})
    if existing:
        raise HTTPException(status_code=400, detail="This listing already has an open transaction in progress.")
    doc = {
        "id": str(uuid.uuid4()), "listing_id": listing["id"], "buyer_id": buyer_id,
        "seller_id": listing["seller_id"], "agreed_amount": float(amount),
        "payment_method": method, "status": "agreed",
        "buyer_completed": False, "seller_completed": False,
        "meetup_note": listing.get("meetup_note"),
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.transactions.insert_one(doc)
    return doc


async def transaction_public(t: dict, viewer_id: str) -> dict:
    listing = await db.listings.find_one({"id": t["listing_id"]}, {"_id": 0})
    role = "buyer" if t["buyer_id"] == viewer_id else "seller"
    counter_id = t["seller_id"] if role == "buyer" else t["buyer_id"]
    counter = await seller_public(counter_id)
    out = {
        "id": t["id"], "listing_id": t["listing_id"],
        "listing": {"title": listing["title"] if listing else "Listing",
                    "photo": (listing.get("photos") or [None])[0] if listing else None} ,
        "agreed_amount": t["agreed_amount"], "payment_method": t.get("payment_method"),
        "status": t["status"], "role": role, "counterparty": counter,
        "buyer_completed": t.get("buyer_completed"), "seller_completed": t.get("seller_completed"),
        "meetup_note": t.get("meetup_note"), "created_at": t.get("created_at"),
    }
    if role == "buyer":
        seller = await db.users.find_one({"id": t["seller_id"]}, {"_id": 0})
        out["pay_targets"] = pay_targets(seller or {}, t["agreed_amount"])
    return out


@api.get("/transactions/mine")
async def my_transactions(user: dict = Depends(require_verified)):
    docs = await db.transactions.find(
        {"$or": [{"buyer_id": user["id"]}, {"seller_id": user["id"]}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"transactions": [await transaction_public(t, user["id"]) for t in docs]}


@api.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str, user: dict = Depends(require_verified)):
    t = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not t or user["id"] not in (t["buyer_id"], t["seller_id"]):
        raise HTTPException(status_code=404, detail="Transaction not found")
    return await transaction_public(t, user["id"])


@api.post("/transactions/{tx_id}/method")
async def set_tx_method(tx_id: str, body: dict, user: dict = Depends(require_verified)):
    t = await db.transactions.find_one({"id": tx_id})
    if not t or t["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the buyer can choose the method")
    method = body.get("payment_method")
    if method not in ("paypal", "venmo"):
        raise HTTPException(status_code=400, detail="Invalid method")
    await db.transactions.update_one({"id": tx_id}, {"$set": {"payment_method": method, "updated_at": now_iso()}})
    return {"status": "ok", "payment_method": method}


@api.post("/transactions/{tx_id}/complete")
async def complete_transaction(tx_id: str, user: dict = Depends(require_verified)):
    t = await db.transactions.find_one({"id": tx_id})
    if not t or user["id"] not in (t["buyer_id"], t["seller_id"]):
        raise HTTPException(status_code=404, detail="Transaction not found")
    if t["status"] != "agreed":
        raise HTTPException(status_code=400, detail="Transaction is not open")
    field = "buyer_completed" if user["id"] == t["buyer_id"] else "seller_completed"
    await db.transactions.update_one({"id": tx_id}, {"$set": {field: True, "updated_at": now_iso()}})
    t = await db.transactions.find_one({"id": tx_id})
    if t.get("buyer_completed") and t.get("seller_completed"):
        await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "completed", "updated_at": now_iso()}})
        await db.listings.update_one({"id": t["listing_id"]}, {"$set": {"status": "sold", "updated_at": now_iso()}})
        return {"status": "ok", "transaction_status": "completed"}
    return {"status": "ok", "transaction_status": "agreed", "waiting_on_other_party": True}


@api.post("/transactions/{tx_id}/cancel")
async def cancel_transaction(tx_id: str, user: dict = Depends(require_verified)):
    t = await db.transactions.find_one({"id": tx_id})
    if not t or user["id"] not in (t["buyer_id"], t["seller_id"]):
        raise HTTPException(status_code=404, detail="Transaction not found")
    if t["status"] != "agreed":
        raise HTTPException(status_code=400, detail="Transaction is not open")
    await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "cancelled", "updated_at": now_iso()}})
    return {"status": "ok", "transaction_status": "cancelled"}


# --------------------------- Admin listing-fee config (Lane B placeholder) ---------------------------
@api.get("/admin/listing-fee")
async def get_listing_fee(admin: dict = Depends(require_admin)):
    cfg = await db.config.find_one({"key": "listing_fee"}, {"_id": 0})
    if not cfg:
        cfg = {"key": "listing_fee", "amount": 0.0, "active": False}
        await db.config.insert_one({**cfg, "created_at": now_iso()})
    return {"amount": cfg.get("amount", 0.0), "active": cfg.get("active", False)}


@api.put("/admin/listing-fee")
async def set_listing_fee(body: FeeConfigBody, admin: dict = Depends(require_admin)):
    await db.config.update_one({"key": "listing_fee"},
                               {"$set": {"amount": float(body.amount), "active": bool(body.active),
                                         "updated_at": now_iso()}}, upsert=True)
    return {"amount": float(body.amount), "active": bool(body.active)}


@api.post("/upload/video")
async def upload_video(file: UploadFile = File(...), user: dict = Depends(require_verified)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "").lower()
    if ext not in VIDEO_MIME:
        raise HTTPException(status_code=400, detail="Only MP4, MOV, WEBM or M4V videos are allowed")
    data = await file.read()
    if len(data) > 120 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video must be under 120MB")
    path = f"{APP_NAME}/videos/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, VIDEO_MIME[ext])
    except Exception as e:
        logger.error(f"video upload failed: {e}")
        raise HTTPException(status_code=502, detail="Video upload failed, please try again")
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"],
        "original_filename": file.filename, "content_type": VIDEO_MIME[ext],
        "size": result.get("size"), "owner_id": user["id"], "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


async def sync_story(listing: dict):
    """A story exists only for a LIVE listing that has a video; it always resolves to its listing."""
    lid = listing["id"]
    if listing.get("status") == "live" and listing.get("video"):
        existing = await db.stories.find_one({"listing_id": lid})
        if existing:
            await db.stories.update_one({"listing_id": lid}, {"$set": {
                "video": listing["video"], "active": True, "updated_at": now_iso()}})
        else:
            order = await db.stories.count_documents({})
            await db.stories.insert_one({
                "id": str(uuid.uuid4()), "listing_id": lid, "seller_id": listing["seller_id"],
                "video": listing["video"], "order": order, "active": True,
                "created_at": now_iso(), "updated_at": now_iso(),
            })
    else:
        await db.stories.update_one({"listing_id": lid}, {"$set": {"active": False}})


@api.get("/stories")
async def get_stories(user: dict = Depends(require_verified)):
    stories = await db.stories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    resolved = []
    for s in stories:
        listing = await db.listings.find_one({"id": s["listing_id"]}, {"_id": 0})
        if not listing or listing.get("status") != "live" or not listing.get("video"):
            continue
        resolved.append((s, listing))
    # Boosted listings get priority placement in the Featured Stories reel.
    resolved.sort(key=lambda pair: (0 if _featured_active(pair[1]) else 1, pair[0].get("order", 0)))
    out = []
    for s, listing in resolved:
        out.append({
            "id": s["id"], "listing_id": s["listing_id"], "video": s["video"],
            "title": listing["title"], "price": listing["price"],
            "photo": (listing.get("photos") or [None])[0],
            "featured": _featured_active(listing),
            "seller": await seller_public(s["seller_id"]),
        })
    return {"stories": out}


# ---------------------------------------------------------------------------
# LANE B — platform services via Stripe (First Unit is the MERCHANT).
# Boosts now; the listing fee bills through the SAME layer later. Stripe is
# NEVER used for item-sale money between members (constraint 6 = Lane A only).
# ---------------------------------------------------------------------------
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"


class BoostTypeBody(BaseModel):
    name: str = Field(min_length=1)
    price: float = Field(ge=0)
    until_sold: bool = False
    duration_days: Optional[int] = Field(default=None, ge=1)
    hidden: bool = False
    active: bool = True


class BoostFeatureBody(BaseModel):
    enabled: bool


class BoostCheckoutBody(BaseModel):
    boost_type_id: str
    origin_url: str


def boost_type_public(b: dict) -> dict:
    return {
        "id": b["id"], "name": b["name"], "price": b.get("price", 0.0),
        "until_sold": b.get("until_sold", False), "duration_days": b.get("duration_days"),
        "hidden": b.get("hidden", False), "active": b.get("active", True),
        "order": b.get("order", 0),
    }


async def get_boost_feature_enabled() -> bool:
    cfg = await db.config.find_one({"key": "boost_feature"}, {"_id": 0})
    return True if not cfg else bool(cfg.get("enabled", True))


async def get_listing_fee_cfg() -> dict:
    cfg = await db.config.find_one({"key": "listing_fee"}, {"_id": 0})
    if not cfg:
        return {"amount": 0.0, "active": False}
    return {"amount": cfg.get("amount", 0.0), "active": cfg.get("active", False)}


# --------------------------- Admin boost management ---------------------------
@api.get("/admin/boost-types")
async def admin_list_boosts(admin: dict = Depends(require_admin)):
    docs = await db.boost_types.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"boost_types": [boost_type_public(b) for b in docs],
            "feature_enabled": await get_boost_feature_enabled()}


@api.post("/admin/boost-types")
async def admin_create_boost(body: BoostTypeBody, admin: dict = Depends(require_admin)):
    if not body.until_sold and not body.duration_days:
        raise HTTPException(status_code=400, detail="Set a duration in days or mark it 'Until sold'")
    order = await db.boost_types.count_documents({})
    doc = {
        "id": str(uuid.uuid4()), "name": body.name.strip(), "price": float(body.price),
        "until_sold": body.until_sold, "duration_days": None if body.until_sold else body.duration_days,
        "hidden": body.hidden, "active": body.active, "order": order,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.boost_types.insert_one(doc)
    return boost_type_public(doc)


@api.put("/admin/boost-types/{boost_id}")
async def admin_update_boost(boost_id: str, body: BoostTypeBody, admin: dict = Depends(require_admin)):
    b = await db.boost_types.find_one({"id": boost_id})
    if not b:
        raise HTTPException(status_code=404, detail="Boost type not found")
    if not body.until_sold and not body.duration_days:
        raise HTTPException(status_code=400, detail="Set a duration in days or mark it 'Until sold'")
    updates = {
        "name": body.name.strip(), "price": float(body.price), "until_sold": body.until_sold,
        "duration_days": None if body.until_sold else body.duration_days,
        "hidden": body.hidden, "active": body.active, "updated_at": now_iso(),
    }
    await db.boost_types.update_one({"id": boost_id}, {"$set": updates})
    b.update(updates)
    return boost_type_public(b)


@api.delete("/admin/boost-types/{boost_id}")
async def admin_delete_boost(boost_id: str, admin: dict = Depends(require_admin)):
    res = await db.boost_types.delete_one({"id": boost_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Boost type not found")
    return {"status": "ok"}


@api.put("/admin/boost-feature")
async def admin_boost_feature(body: BoostFeatureBody, admin: dict = Depends(require_admin)):
    await db.config.update_one({"key": "boost_feature"},
                               {"$set": {"enabled": bool(body.enabled), "updated_at": now_iso()}},
                               upsert=True)
    return {"enabled": bool(body.enabled)}


# --------------------------- Member boost options + checkout ---------------------------
@api.get("/boost/options")
async def boost_options(user: dict = Depends(require_verified)):
    feature = await get_boost_feature_enabled()
    tiers = []
    if feature:
        docs = await db.boost_types.find({"active": True, "hidden": False}, {"_id": 0}).sort("order", 1).to_list(200)
        tiers = [boost_type_public(b) for b in docs]
    return {"feature_enabled": feature, "boost_types": tiers, "listing_fee": await get_listing_fee_cfg()}


async def _apply_boost(listing_id: str, bt: dict, stripe_ref: str):
    starts = datetime.now(timezone.utc)
    new_ends = None if bt.get("until_sold") else starts + timedelta(days=int(bt.get("duration_days") or 0))
    # Never shorten an already-active featured window (stacking a shorter boost keeps the longer end).
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if listing and _featured_active(listing):
        cur = listing.get("featured_until")
        if cur is None:  # existing 'Until sold' boost is effectively unlimited — keep it
            new_ends = None
        elif new_ends is not None:
            try:
                cur_dt = datetime.fromisoformat(cur)
                if cur_dt > new_ends:
                    new_ends = cur_dt
            except Exception:
                pass
    ends_iso = new_ends.isoformat() if new_ends else None
    await db.boost_purchases.insert_one({
        "id": str(uuid.uuid4()), "listing_id": listing_id, "boost_type_id": bt["id"],
        "boost_name": bt["name"], "until_sold": bt.get("until_sold", False),
        "duration_days": bt.get("duration_days"), "price": bt.get("price"),
        "stripe_ref": stripe_ref, "starts_at": starts.isoformat(), "ends_at": ends_iso,
        "created_at": now_iso(),
    })
    await db.listings.update_one({"id": listing_id}, {"$set": {
        "featured": True, "featured_until": ends_iso, "boosted_at": starts.isoformat(),
        "updated_at": now_iso()}})


async def _create_platform_checkout(*, kind, amount, description, metadata, origin_url):
    session = await asyncio.to_thread(
        lambda: stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price_data": {"currency": "usd", "unit_amount": int(round(float(amount) * 100)),
                                         "product_data": {"name": description}}, "quantity": 1}],
            success_url=f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin_url}/payment/cancel",
            metadata={**metadata, "kind": kind},
        )
    )
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "kind": kind, "amount": float(amount),
        "currency": "usd", "description": description, "metadata": metadata,
        "status": "initiated", "payment_status": "pending", "fulfilled": False,
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return session


async def _fulfill_payment(rec: dict):
    if rec.get("fulfilled") or rec.get("payment_status") != "paid":
        return
    meta = rec.get("metadata", {})
    if rec.get("kind") == "boost":
        bt = await db.boost_types.find_one({"id": meta.get("boost_type_id")})
        if bt and meta.get("listing_id"):
            await _apply_boost(meta["listing_id"], bt, stripe_ref=rec["session_id"])
    # kind == "listing_fee": future — same layer marks the publish paid here, no rebuild needed.
    await db.payment_transactions.update_one({"session_id": rec["session_id"]},
                                             {"$set": {"fulfilled": True, "updated_at": now_iso()}})


@api.post("/listings/{listing_id}/boost/checkout")
async def boost_checkout(listing_id: str, body: BoostCheckoutBody, user: dict = Depends(require_verified)):
    if not await get_boost_feature_enabled():
        raise HTTPException(status_code=400, detail="Boosts are currently unavailable")
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["seller_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your listing")
    if listing.get("status") != "live":
        raise HTTPException(status_code=400, detail="Only a live listing can be boosted")
    bt = await db.boost_types.find_one({"id": body.boost_type_id})
    if not bt or not bt.get("active") or bt.get("hidden"):
        raise HTTPException(status_code=404, detail="Boost tier not available")
    fee = await get_listing_fee_cfg()
    fee_amount = float(fee["amount"]) if fee.get("active") else 0.0
    total = float(bt["price"]) + fee_amount
    if total <= 0:
        await _apply_boost(listing_id, bt, stripe_ref="free")
        return {"free": True, "listing_id": listing_id}
    metadata = {"listing_id": listing_id, "boost_type_id": bt["id"], "user_id": user["id"],
                "fee_amount": f"{fee_amount:.2f}"}
    session = await _create_platform_checkout(
        kind="boost", amount=total,
        description=f"{bt['name']} — First Unit listing boost", metadata=metadata,
        origin_url=body.origin_url.rstrip("/"))
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/payments/status/{session_id}")
async def payment_status_check(session_id: str):
    rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if rec.get("payment_status") != "paid":
        try:
            s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_payment_intent_id": s.payment_intent, "updated_at": now_iso()}})
                rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
                await _fulfill_payment(rec)
                rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except Exception as e:
            logger.error(f"stripe status check failed: {e}")
    return {"session_id": rec["session_id"], "status": rec["status"],
            "payment_status": rec["payment_status"], "kind": rec.get("kind"),
            "metadata": rec.get("metadata", {})}


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "stripe_payment_intent_id": obj.get("payment_intent"), "updated_at": now_iso()}})
        rec = await db.payment_transactions.find_one({"session_id": obj["id"]}, {"_id": 0})
        if rec:
            await _fulfill_payment(rec)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Phase 8 — verified-only buyer↔seller messaging + in-chat reporting.
# Only approved members (require_verified) can send/receive. Participants are
# always shown via the public handle layer (constraint 3). Reports created here;
# the moderation queue/handling is Phase 9.
# ---------------------------------------------------------------------------
REPORT_REASONS = {
    "scam_fraud": "Scam or fraud",
    "prohibited_item": "Prohibited item",
    "harassment": "Harassment",
    "spam": "Spam",
    "other": "Other",
}
ACTIVE_VIEW_WINDOW = 30  # seconds; within this the recipient is treated as "actively viewing"


async def create_notification(user_id, ntype, title, body, thread_id=None, listing_id=None):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": ntype, "title": title,
        "body": body, "thread_id": thread_id, "listing_id": listing_id,
        "read": False, "created_at": now_iso(),
    })


def message_email_html(sender_handle: str, preview: str, link: str) -> str:
    return (
        f'<table role="presentation" width="100%" style="background:#f2f3f5;padding:32px 0">'
        f'<tr><td align="center"><table role="presentation" width="520" '
        f'style="background:#ffffff;border:1px solid #d9dce1;font-family:Arial,Helvetica,sans-serif">'
        f'<tr><td style="background:#0b1f42;padding:20px 28px;color:#ffffff;font-size:18px;'
        f'letter-spacing:2px;font-weight:bold">FIRST UNIT</td></tr>'
        f'<tr><td style="padding:28px">'
        f'<h1 style="font-size:19px;color:#12151b;margin:0 0 12px">New message from {escape(sender_handle)}</h1>'
        f'<p style="font-size:14px;color:#50565f;line-height:1.6;border-left:3px solid #a6192e;'
        f'padding-left:12px">{escape(preview)}</p>'
        f'<p style="margin:22px 0"><a href="{link}" style="background:#a6192e;color:#ffffff;'
        f'text-decoration:none;padding:12px 24px;font-size:14px;font-weight:bold;border-radius:2px;'
        f'display:inline-block">Open conversation</a></p>'
        f'<p style="font-size:12px;color:#868c96">Keep payments off-platform and meet in a safe, '
        f'public place. First Unit will never ask for your password or credential documents.</p></td></tr>'
        f'<tr><td style="padding:16px 28px;background:#f2f3f5;font-size:11px;color:#868c96">'
        f'Sent by First Unit — a verified marketplace for first responders.</td></tr>'
        f'</table></td></tr></table>'
    )


async def _thread_other(thread: dict, me: str) -> str:
    return next((p for p in thread["participants"] if p != me), me)


async def _listing_brief(listing_id: str) -> dict:
    l = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not l:
        return {"id": listing_id, "title": "Listing unavailable", "price": None, "photo": None}
    return {"id": l["id"], "title": l["title"], "price": l.get("price"),
            "photo": (l.get("photos") or [None])[0], "status": l.get("status")}


async def _thread_unread(thread_id: str, me: str) -> int:
    return await db.messages.count_documents(
        {"thread_id": thread_id, "sender_id": {"$ne": me}, "read_by": {"$ne": me}})


async def thread_summary(thread: dict, me: str) -> dict:
    other_id = await _thread_other(thread, me)
    return {
        "id": thread["id"],
        "listing": await _listing_brief(thread["listing_id"]),
        "other": await seller_public(other_id),
        "last_message": thread.get("last_message"),
        "last_message_at": thread.get("last_message_at"),
        "unread_count": await _thread_unread(thread["id"], me),
        "updated_at": thread.get("updated_at"),
    }


def message_public(m: dict, me: str) -> dict:
    return {
        "id": m["id"], "sender_id": m["sender_id"], "body": m["body"],
        "created_at": m["created_at"], "mine": m["sender_id"] == me,
        "read": me in m.get("read_by", []) or m["sender_id"] == me,
    }


class ThreadStartBody(BaseModel):
    listing_id: str
    body: Optional[str] = None


class MessageBody(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ReportBody(BaseModel):
    reason: str
    note: Optional[str] = Field(default=None, max_length=2000)


async def _get_thread_guarded(thread_id: str, me: str) -> dict:
    thread = await db.message_threads.find_one({"id": thread_id})
    if not thread or me not in thread.get("participants", []):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return thread


async def _deliver_message(thread: dict, sender: dict, body_text: str):
    """Insert a message, bump the thread, and notify the recipient (in-app always;
    email + SMS only when they are not actively viewing the thread)."""
    me = sender["id"]
    recipient_id = await _thread_other(thread, me)
    msg = {
        "id": str(uuid.uuid4()), "thread_id": thread["id"], "sender_id": me,
        "body": body_text, "read_by": [me], "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    await db.message_threads.update_one({"id": thread["id"]}, {"$set": {
        "last_message": body_text[:160], "last_message_at": now_iso(),
        "last_sender_id": me, "updated_at": now_iso()}})

    sender_profile = await db.profiles.find_one({"user_id": me}, {"_id": 0})
    sender_handle = public_profile(sender_profile)["display_handle"] if sender_profile else "A member"
    preview = body_text[:140]
    link = f"{FRONTEND_URL}/messages/{thread['id']}"

    await create_notification(recipient_id, "message", f"New message from {sender_handle}",
                              preview, thread_id=thread["id"], listing_id=thread["listing_id"])

    # Actively-viewing check: recipient opened this thread within the last ACTIVE_VIEW_WINDOW.
    viewed = (thread.get("last_viewed") or {}).get(recipient_id)
    actively_viewing = False
    if viewed:
        try:
            actively_viewing = (datetime.now(timezone.utc) - datetime.fromisoformat(viewed)).total_seconds() < ACTIVE_VIEW_WINDOW
        except Exception:
            actively_viewing = False
    if not actively_viewing:
        recipient = await db.users.find_one({"id": recipient_id}, {"_id": 0})
        if recipient:
            if recipient.get("email"):
                try:
                    await send_email(to=recipient["email"],
                                     subject=f"First Unit — new message from {sender_handle}",
                                     html=message_email_html(sender_handle, preview, link))
                except Exception as e:
                    logger.error(f"message email failed: {e}")
            if recipient.get("phone"):
                try:
                    await send_sms(recipient["phone"], f"First Unit: new message from {sender_handle}. {preview}")
                except Exception as e:
                    logger.error(f"message sms failed: {e}")
    return msg


@api.post("/threads")
async def start_thread(body: ThreadStartBody, user: dict = Depends(require_verified)):
    listing = await db.listings.find_one({"id": body.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    seller_id = listing["seller_id"]
    if seller_id == user["id"]:
        raise HTTPException(status_code=400, detail="You can't message yourself on your own listing")
    existing = await db.message_threads.find_one({
        "listing_id": body.listing_id, "participants": {"$all": [user["id"], seller_id]}})
    if existing:
        thread = existing
    else:
        thread = {
            "id": str(uuid.uuid4()), "listing_id": body.listing_id,
            "participants": [user["id"], seller_id], "buyer_id": user["id"], "seller_id": seller_id,
            "last_message": None, "last_message_at": None, "last_sender_id": None,
            "last_viewed": {}, "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.message_threads.insert_one(thread)
    if body.body and body.body.strip():
        await _deliver_message(thread, user, body.body.strip())
        thread = await db.message_threads.find_one({"id": thread["id"]})
    return await thread_summary(thread, user["id"])


@api.get("/threads")
async def list_threads(user: dict = Depends(require_verified)):
    threads = await db.message_threads.find(
        {"participants": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    out = [await thread_summary(t, user["id"]) for t in threads]
    total_unread = sum(t["unread_count"] for t in out)
    return {"threads": out, "total_unread": total_unread}


@api.get("/messages/unread-count")
async def messages_unread_count(user: dict = Depends(require_verified)):
    n = await db.messages.count_documents(
        {"sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]},
         "thread_id": {"$in": [t["id"] async for t in db.message_threads.find(
             {"participants": user["id"]}, {"id": 1})]}})
    return {"unread": n}


@api.get("/threads/{thread_id}")
async def get_thread(thread_id: str, user: dict = Depends(require_verified)):
    thread = await _get_thread_guarded(thread_id, user["id"])
    # Mark the current user as an active viewer + mark their unread messages read.
    await db.message_threads.update_one(
        {"id": thread_id}, {"$set": {f"last_viewed.{user['id']}": now_iso()}})
    await db.messages.update_many(
        {"thread_id": thread_id, "sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]}},
        {"$addToSet": {"read_by": user["id"]}})
    await db.notifications.update_many(
        {"user_id": user["id"], "thread_id": thread_id, "read": False}, {"$set": {"read": True}})
    msgs = await db.messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return {
        "id": thread["id"],
        "listing": await _listing_brief(thread["listing_id"]),
        "other": await seller_public(await _thread_other(thread, user["id"])),
        "messages": [message_public(m, user["id"]) for m in msgs],
    }


@api.post("/threads/{thread_id}/messages")
async def post_message(thread_id: str, body: MessageBody, user: dict = Depends(require_verified)):
    thread = await _get_thread_guarded(thread_id, user["id"])
    msg = await _deliver_message(thread, user, body.body.strip())
    return message_public(msg, user["id"])


@api.post("/threads/{thread_id}/report")
async def report_thread(thread_id: str, body: ReportBody, user: dict = Depends(require_verified)):
    if body.reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail="Invalid report reason")
    thread = await _get_thread_guarded(thread_id, user["id"])
    other_id = await _thread_other(thread, user["id"])
    msgs = await db.messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    snapshot = [{"sender_id": m["sender_id"], "body": m["body"], "created_at": m["created_at"]} for m in msgs]
    await db.reports.insert_one({
        "id": str(uuid.uuid4()), "reporter": user["id"], "target_type": "message_thread",
        "target_id": thread_id, "reported_user": other_id, "listing_id": thread["listing_id"],
        "reason": REPORT_REASONS[body.reason], "reason_code": body.reason,
        "note": (body.note or "").strip() or None, "thread_snapshot": snapshot,
        "status": "open", "reviewer": None, "created_at": now_iso(),
    })
    return {"status": "ok", "message": "Report submitted to Trust & Safety."}


@api.get("/notifications")
async def get_notifications(user: dict = Depends(require_verified)):
    docs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    unread = sum(1 for d in docs if not d.get("read"))
    return {"notifications": docs, "unread": unread}


@api.post("/notifications/read")
async def mark_notifications_read(user: dict = Depends(require_verified)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Phase 9 — Trust & Safety: reporting across the app + admin moderation.
# Reports: reporter, target_type (listing|user|message_thread), target_id, reason,
# status (open|reviewing|actioned|dismissed), reviewer. Every moderation/admin
# action writes an AdminAction audit entry. Admin-only routes; verified-only members.
# ---------------------------------------------------------------------------
REPORT_STATUSES = {"open", "reviewing", "actioned", "dismissed"}


class CreateReportBody(BaseModel):
    target_type: str  # "listing" | "user"
    target_id: str
    reason: str
    note: Optional[str] = Field(default=None, max_length=2000)


async def audit(admin: dict, action: str, target_type: str, target_id: str, detail: dict = None):
    await db.admin_actions.insert_one({
        "id": str(uuid.uuid4()), "admin_id": admin["id"], "admin_email": admin.get("email"),
        "action": action, "target_type": target_type, "target_id": target_id,
        "detail": detail or {}, "timestamp": now_iso(),
    })


@api.post("/reports")
async def create_report(body: CreateReportBody, user: dict = Depends(require_verified)):
    if body.reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail="Invalid report reason")
    if body.target_type not in ("listing", "user"):
        raise HTTPException(status_code=400, detail="Invalid report target")
    doc = {
        "id": str(uuid.uuid4()), "reporter": user["id"], "target_type": body.target_type,
        "target_id": body.target_id, "reason": REPORT_REASONS[body.reason],
        "reason_code": body.reason, "note": (body.note or "").strip() or None,
        "status": "open", "reviewer": None, "created_at": now_iso(), "updated_at": now_iso(),
    }
    if body.target_type == "listing":
        listing = await db.listings.find_one({"id": body.target_id}, {"_id": 0})
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        doc["reported_user"] = listing["seller_id"]
        doc["listing_id"] = body.target_id
    else:  # user
        target = await db.users.find_one({"id": body.target_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="Member not found")
        if body.target_id == user["id"]:
            raise HTTPException(status_code=400, detail="You can't report yourself")
        doc["reported_user"] = body.target_id
    await db.reports.insert_one(doc)
    return {"status": "ok", "message": "Report submitted to Trust & Safety."}


async def _report_enrich(r: dict) -> dict:
    out = {
        "id": r["id"], "target_type": r["target_type"], "target_id": r["target_id"],
        "reason": r.get("reason"), "reason_code": r.get("reason_code"), "note": r.get("note"),
        "status": r.get("status", "open"), "reviewer": r.get("reviewer"),
        "created_at": r.get("created_at"), "listing_id": r.get("listing_id"),
        "has_snapshot": bool(r.get("thread_snapshot")),
        "snapshot_count": len(r.get("thread_snapshot", [])),
    }
    reporter = r.get("reporter")
    out["reporter"] = "System" if reporter == "System" else (
        (await seller_public(reporter))["display_handle"] if reporter else "—")
    if r.get("reported_user"):
        out["reported_user"] = r["reported_user"]
        ru = await db.users.find_one({"id": r["reported_user"]}, {"_id": 0})
        out["reported_user_handle"] = (await seller_public(r["reported_user"]))["display_handle"]
        out["reported_user_status"] = ru.get("verification_status") if ru else None
    lid = r.get("listing_id") or (r["target_id"] if r["target_type"] == "listing" else None)
    if lid:
        out["listing"] = await _listing_brief(lid)
    return out


@api.get("/admin/reports")
async def admin_list_reports(status: Optional[str] = Query(None), admin: dict = Depends(require_admin)):
    q = {}
    if status and status in REPORT_STATUSES:
        q["status"] = status
    reports = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Open first, then by recency.
    order = {"open": 0, "reviewing": 1, "actioned": 2, "dismissed": 3}
    reports.sort(key=lambda r: (order.get(r.get("status", "open"), 4), ))
    return {"reports": [await _report_enrich(r) for r in reports]}


@api.get("/admin/reports/{report_id}")
async def admin_get_report(report_id: str, admin: dict = Depends(require_admin)):
    r = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    out = await _report_enrich(r)
    out["thread_snapshot"] = r.get("thread_snapshot", [])
    return out


class ReportStatusBody(BaseModel):
    status: str
    note: Optional[str] = None


@api.post("/admin/reports/{report_id}/status")
async def admin_set_report_status(report_id: str, body: ReportStatusBody, admin: dict = Depends(require_admin)):
    if body.status not in REPORT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.reports.update_one({"id": report_id}, {"$set": {
        "status": body.status, "reviewer": admin["email"], "updated_at": now_iso()}})
    await audit(admin, f"report_{body.status}", "report", report_id,
                {"note": body.note, "reason": r.get("reason")})
    return {"status": "ok", "report_status": body.status}


class ListingModerateBody(BaseModel):
    action: str  # "remove" | "reinstate"
    reason: Optional[str] = None


@api.get("/admin/listings")
async def admin_list_listings(status: Optional[str] = Query(None), admin: dict = Depends(require_admin)):
    q = {}
    if status and status != "all":
        q["status"] = status
    docs = await db.listings.find(q, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    order = {"flagged": 0, "live": 1, "removed": 2, "sold": 3, "draft": 4}
    docs.sort(key=lambda d: (order.get(d.get("status"), 5), ))
    out = []
    for d in docs:
        open_reports = await db.reports.count_documents(
            {"target_type": "listing", "target_id": d["id"], "status": {"$in": ["open", "reviewing"]}})
        out.append({
            "id": d["id"], "title": d["title"], "status": d.get("status"),
            "category": d.get("category"), "price": d.get("price"),
            "photo": (d.get("photos") or [None])[0], "seller_id": d["seller_id"],
            "seller": (await seller_public(d["seller_id"]))["display_handle"],
            "open_reports": open_reports, "created_at": d.get("created_at"),
        })
    return {"listings": out}


@api.post("/admin/listings/{listing_id}/moderate")
async def admin_moderate_listing(listing_id: str, body: ListingModerateBody, admin: dict = Depends(require_admin)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if body.action == "remove":
        new_status = "removed"
    elif body.action == "reinstate":
        new_status = "live"
    else:
        raise HTTPException(status_code=400, detail="action must be 'remove' or 'reinstate'")
    await db.listings.update_one({"id": listing_id}, {"$set": {"status": new_status, "updated_at": now_iso()}})
    await sync_story({**listing, "status": new_status})
    # Resolve open reports on this listing when removed.
    if new_status == "removed":
        await db.reports.update_many(
            {"target_type": "listing", "target_id": listing_id, "status": {"$in": ["open", "reviewing"]}},
            {"$set": {"status": "actioned", "reviewer": admin["email"], "updated_at": now_iso()}})
    await audit(admin, f"listing_{body.action}", "listing", listing_id,
                {"reason": body.reason, "new_status": new_status})
    return {"status": "ok", "listing_status": new_status}


class UserModerateBody(BaseModel):
    action: str  # "warn" | "suspend" | "reinstate"
    reason: Optional[str] = None


@api.post("/admin/users/{user_id}/moderate")
async def admin_moderate_user(user_id: str, body: UserModerateBody, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot moderate an admin account")
    reason = (body.reason or "").strip()
    if body.action == "warn":
        await create_notification(
            user_id, "warning", "A warning from Trust & Safety",
            reason or "Please review the community conduct rules. Continued issues may lead to suspension.")
        await audit(admin, "user_warn", "user", user_id, {"reason": reason or None})
        return {"status": "ok", "action": "warn"}
    if body.action == "suspend":
        await db.users.update_one({"id": user_id}, {"$set": {"verification_status": "suspended"}})
        rec = await db.verification_records.find_one({"user_id": user_id})
        if rec:
            await db.verification_records.update_one(
                {"user_id": user_id}, {"$set": {"current_state": "suspended", "updated_at": now_iso()}})
        await db.profiles.update_one({"user_id": user_id}, {"$set": {"verified_badge": False}})
        await create_notification(
            user_id, "suspension", "Your account has been suspended",
            reason or "Your access to First Unit has been suspended by Trust & Safety.")
        await audit(admin, "user_suspend", "user", user_id, {"reason": reason or None})
        return {"status": "ok", "action": "suspend", "verification_status": "suspended"}
    if body.action == "reinstate":
        await db.users.update_one({"id": user_id}, {"$set": {"verification_status": "approved"}})
        rec = await db.verification_records.find_one({"user_id": user_id})
        if rec:
            await db.verification_records.update_one(
                {"user_id": user_id}, {"$set": {"current_state": "approved", "updated_at": now_iso()}})
        await db.profiles.update_one({"user_id": user_id}, {"$set": {"verified_badge": True}})
        await create_notification(
            user_id, "reinstated", "Your account has been reinstated",
            "Welcome back — your First Unit access has been restored.")
        await audit(admin, "user_reinstate", "user", user_id, {"reason": reason or None})
        return {"status": "ok", "action": "reinstate", "verification_status": "approved"}
    raise HTTPException(status_code=400, detail="action must be 'warn', 'suspend' or 'reinstate'")


@api.get("/admin/audit-log")
async def admin_audit_log(admin: dict = Depends(require_admin)):
    docs = await db.admin_actions.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return {"actions": docs}


@api.get("/admin/health")
async def admin_health(admin: dict = Depends(require_admin)):
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    async def uc(**q):
        return await db.users.count_documents(q)

    async def lc(**q):
        return await db.listings.count_documents(q)

    async def rc(**q):
        return await db.reports.count_documents(q)

    verification = {
        "approved": await uc(verification_status="approved", role="member"),
        "human_review": await db.verification_records.count_documents({"current_state": "human_review"}),
        "pending": await db.users.count_documents(
            {"role": "member", "verification_status": {"$in": ["unverified", "pre_screen", "validating"]}}),
        "rejected": await uc(verification_status="rejected", role="member"),
        "suspended": await uc(verification_status="suspended", role="member"),
    }
    approvals_7d = await db.admin_actions.count_documents(
        {"action": {"$in": ["verification_approve", "manual_verification_override"]}, "timestamp": {"$gte": week_ago}})
    return {
        "verification": verification,
        "verification_throughput_7d": await db.verification_records.count_documents(
            {"outcome": "approved", "updated_at": {"$gte": week_ago}}) + approvals_7d,
        "listings": {
            "live": await lc(status="live"),
            "flagged": await lc(status="flagged"),
            "removed": await lc(status="removed"),
            "sold": await lc(status="sold"),
            "draft": await lc(status="draft"),
            "total": await lc(),
        },
        "listing_activity_7d": await lc(created_at={"$gte": week_ago}),
        "reports": {
            "open": await rc(status="open"),
            "reviewing": await rc(status="reviewing"),
            "actioned": await rc(status="actioned"),
            "dismissed": await rc(status="dismissed"),
        },
        "signups": {
            "members_total": await uc(role="member"),
            "members_7d": await db.users.count_documents({"role": "member", "created_at": {"$gte": week_ago}}),
        },
        "messages": {"threads": await db.message_threads.count_documents({})},
    }


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
                "photo_visibility": "avatar", "undercover": False, "created_at": now_iso(),
            })
        elif not verify_password(password, existing["password_hash"]):
            await db.users.update_one({"email": email},
                                      {"$set": {"password_hash": hash_password(password),
                                                "role": "admin", "verification_status": "approved"}})


async def seed_boosts():
    if await db.boost_types.count_documents({}) == 0:
        defaults = [
            {"name": "3-Day Boost", "price": 9.0, "until_sold": False, "duration_days": 3},
            {"name": "7-Day Boost", "price": 19.0, "until_sold": False, "duration_days": 7},
            {"name": "Until Sold", "price": 29.0, "until_sold": True, "duration_days": None},
        ]
        for i, d in enumerate(defaults):
            await db.boost_types.insert_one({
                "id": str(uuid.uuid4()), **d, "hidden": False, "active": True, "order": i,
                "created_at": now_iso(), "updated_at": now_iso(),
            })
    await db.config.update_one({"key": "boost_feature"},
                               {"$setOnInsert": {"enabled": True, "created_at": now_iso()}}, upsert=True)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("token")
    await db.login_attempts.create_index("identifier")
    await db.verification_events.create_index("verification_id")
    await db.profiles.create_index("user_id")
    await db.listings.create_index("seller_id")
    await db.listings.create_index("status")
    await db.offers.create_index("listing_id")
    await db.files.create_index("storage_path")
    await seed_admins()
    await seed_categories()
    await seed_boosts()
    try:
        await asyncio.to_thread(init_storage)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed (uploads may not work yet): {e}")
    logger.info("First Unit API started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
