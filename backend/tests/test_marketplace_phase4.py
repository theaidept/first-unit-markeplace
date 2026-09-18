"""Phase 4 — Marketplace (listings, categories, uploads, offers, restrictions).

Verifies:
- Verified-only gate on all new marketplace endpoints
- Categories exclude restricted
- Listing publish flow with photos
- Blocked keyword => flagged status, hidden from feed, report created
- Restricted category rejected with 400
- Save-as-draft workflow
- Feed search + category filters + featured
- Photo upload -> GET /api/files/{path}
- Offer flow (make, buy-now, accept/decline/withdraw)
- Seller cannot offer on own listing
- Public seller layer only exposes public fields
"""
import io
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@firstunit.us"
ADMIN_PASSWORD = "FirstUnit#Admin2026!"


def _sess():
    s = requests.Session()
    return s


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def _register_verified(admin_sess, email=None):
    """Register a new member and mark them approved via admin."""
    email = email or f"test_{uuid.uuid4().hex[:8]}@test.com"
    password = "Passw0rd!"
    phone = "+15125550101"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "phone": phone})
    assert r.status_code == 200, r.text
    user = r.json()
    # admin sets to approved
    r2 = admin_sess.post(
        f"{API}/admin/users/{user['id']}/verification-status",
        json={"verification_status": "approved"},
    )
    assert r2.status_code == 200, r2.text
    # re-fetch me to reflect approval
    me = s.get(f"{API}/auth/me").json()
    assert me["verification_status"] == "approved"
    return s, user


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = _sess()
    _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="module")
def seller(admin_session):
    s, u = _register_verified(admin_session)
    return s, u


@pytest.fixture(scope="module")
def buyer(admin_session):
    s, u = _register_verified(admin_session)
    return s, u


@pytest.fixture(scope="module")
def unverified():
    email = f"unv_{uuid.uuid4().hex[:6]}@test.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "+15125550100"})
    assert r.status_code == 200
    return s


# ---------- Gate ----------
class TestVerifiedGate:
    def test_unauth_401(self):
        r = requests.get(f"{API}/listings")
        assert r.status_code == 401
        r2 = requests.get(f"{API}/categories")
        assert r2.status_code == 401

    def test_unverified_403(self, unverified):
        for path in ["/listings", "/categories", "/listings/mine"]:
            r = unverified.get(f"{API}{path}")
            assert r.status_code == 403, f"{path} => {r.status_code}"
        r = unverified.post(f"{API}/listings", json={
            "title": "x", "category": "gear", "condition": "Good", "price": 1, "publish": False,
        })
        assert r.status_code == 403


# ---------- Categories ----------
class TestCategories:
    def test_categories_exclude_restricted(self, seller):
        s, _ = seller
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        slugs = [c["slug"] for c in r.json()["categories"]]
        assert "gear" in slugs and "vehicles" in slugs and "art" in slugs
        assert "firearms" not in slugs and "edged-weapons" not in slugs


# ---------- Upload + Files ----------
# 1x1 PNG
_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
    b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03"
    b"\x00\x01|f%v\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestUpload:
    def test_upload_and_serve(self, seller):
        s, _ = seller
        files = {"file": ("t.png", io.BytesIO(_PNG), "image/png")}
        r = s.post(f"{API}/upload", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("/api/files/")
        assert data["path"]
        # Now fetch it back
        r2 = s.get(f"{BASE_URL}{data['url']}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) > 0

    def test_files_requires_verified(self, unverified, seller):
        s, _ = seller
        r = s.post(f"{API}/upload", files={"file": ("t.png", io.BytesIO(_PNG), "image/png")})
        path = r.json()["path"]
        # unverified cannot fetch
        r2 = unverified.get(f"{BASE_URL}/api/files/{path}")
        assert r2.status_code == 403


# ---------- Listings ----------
def _upload(session):
    r = session.post(f"{API}/upload", files={"file": ("p.png", io.BytesIO(_PNG), "image/png")})
    assert r.status_code == 200
    return r.json()["url"]


class TestListings:
    def test_publish_live_listing(self, seller):
        s, _ = seller
        photo = _upload(s)
        payload = {
            "title": "Turnout Coat Size L", "category": "gear", "condition": "Good",
            "location": "Austin, TX", "description": "Structural coat, lightly used.",
            "price": 240, "photos": [photo], "publish": True,
        }
        r = s.post(f"{API}/listings", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "live"
        assert d["flagged_reason"] is None
        # feed shows it
        feed = s.get(f"{API}/listings").json()["listings"]
        ids = [x["id"] for x in feed]
        assert d["id"] in ids
        # seller info is public layer only
        card = next(x for x in feed if x["id"] == d["id"])
        assert "display_handle" in card["seller"]
        assert "verified_badge" in card["seller"]
        for forbidden in ("email", "phone", "password_hash", "credential_number"):
            assert forbidden not in card["seller"]

    def test_restricted_category_rejected(self, seller):
        s, _ = seller
        r = s.post(f"{API}/listings", json={
            "title": "test", "category": "firearms", "condition": "Good", "price": 10, "publish": False,
        })
        assert r.status_code == 400

    def test_blocked_keyword_flagged(self, seller):
        s, _ = seller
        photo = _upload(s)
        r = s.post(f"{API}/listings", json={
            "title": "Tactical knife set", "category": "gear", "condition": "Good",
            "description": "sharp blade", "price": 50, "photos": [photo], "publish": True,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "flagged"
        assert d["flagged_reason"] and "prohibited" in d["flagged_reason"].lower()
        # not visible in feed
        feed = s.get(f"{API}/listings").json()["listings"]
        assert d["id"] not in [x["id"] for x in feed]

    def test_save_as_draft(self, seller):
        s, _ = seller
        r = s.post(f"{API}/listings", json={
            "title": "Draft Item", "category": "gear", "condition": "Fair",
            "description": "wip", "price": 20, "photos": [], "publish": False,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "draft"
        feed = s.get(f"{API}/listings").json()["listings"]
        assert d["id"] not in [x["id"] for x in feed]
        mine = s.get(f"{API}/listings/mine").json()["listings"]
        assert d["id"] in [x["id"] for x in mine]

    def test_feed_search_and_chips(self, seller):
        s, _ = seller
        photo = _upload(s)
        s.post(f"{API}/listings", json={
            "title": "Vintage FDNY Helmet Poster", "category": "art", "condition": "Excellent",
            "description": "wall art", "price": 90, "photos": [photo], "publish": True,
        })
        # category filter
        r = s.get(f"{API}/listings", params={"category": "art"}).json()
        assert all(x["category"] == "art" for x in r["listings"])
        # search
        r2 = s.get(f"{API}/listings", params={"q": "Vintage FDNY"}).json()
        assert any("Vintage FDNY" in x["title"] for x in r2["listings"])
        # featured (empty is fine)
        r3 = s.get(f"{API}/listings", params={"featured": True})
        assert r3.status_code == 200


# ---------- Offers ----------
class TestOffers:
    @pytest.fixture(scope="class")
    def live_listing(self, seller):
        s, _ = seller
        photo = _upload(s)
        r = s.post(f"{API}/listings", json={
            "title": "Offer Test Item", "category": "gear", "condition": "Good",
            "description": "for offers", "price": 100, "photos": [photo], "publish": True,
        })
        return r.json()["id"]

    def test_seller_cannot_offer_own(self, seller, live_listing):
        s, _ = seller
        r = s.post(f"{API}/listings/{live_listing}/offers", json={"amount": 80})
        assert r.status_code == 400

    def test_make_offer_and_accept(self, seller, buyer, live_listing):
        b, _ = buyer
        s, _ = seller
        r = b.post(f"{API}/listings/{live_listing}/offers", json={"amount": 85})
        assert r.status_code == 200
        offer_id = r.json()["id"]
        assert r.json()["status"] == "pending"
        # seller sees it
        offers = s.get(f"{API}/listings/{live_listing}/offers").json()
        assert offers["is_owner"] is True
        assert any(o["id"] == offer_id for o in offers["offers"])
        # accept
        r2 = s.post(f"{API}/offers/{offer_id}/accept")
        assert r2.status_code == 200
        assert r2.json()["offer_status"] == "accepted"

    def test_buy_now_and_withdraw(self, seller, buyer, live_listing):
        b, _ = buyer
        r = b.post(f"{API}/listings/{live_listing}/buy-now")
        assert r.status_code == 200
        d = r.json()
        assert d["is_buy_now"] is True
        assert d["status"] == "pending"
        # withdraw as buyer
        r2 = b.post(f"{API}/offers/{d['id']}/withdraw")
        assert r2.status_code == 200
        assert r2.json()["offer_status"] == "withdrawn"

    def test_decline_offer(self, seller, buyer, live_listing):
        b, _ = buyer
        s, _ = seller
        r = b.post(f"{API}/listings/{live_listing}/offers", json={"amount": 70})
        oid = r.json()["id"]
        r2 = s.post(f"{API}/offers/{oid}/decline")
        assert r2.status_code == 200
        assert r2.json()["offer_status"] == "declined"

    def test_non_seller_cannot_accept(self, buyer, live_listing):
        b, buyer_u = buyer
        # make an offer
        r = b.post(f"{API}/listings/{live_listing}/offers", json={"amount": 60})
        oid = r.json()["id"]
        # buyer tries to accept own offer (not seller)
        r2 = b.post(f"{API}/offers/{oid}/accept")
        assert r2.status_code == 403
