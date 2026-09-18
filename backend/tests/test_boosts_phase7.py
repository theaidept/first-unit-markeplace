"""Phase 7 - Boost / Stripe (Lane B) tests."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://first-responders-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

OWNER_EMAIL = "theaidept@gmail.com"
OWNER_PW = "FirstUnit#Owner2026!"


def _sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, pw):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin():
    s = _sess()
    _login(s, OWNER_EMAIL, OWNER_PW)
    return s


@pytest.fixture(scope="module")
def member():
    """Register + approve a fresh verified member via admin fallback."""
    s = _sess()
    email = f"test_boost_{uuid.uuid4().hex[:8]}@example.com"
    pw = "TestPass1234!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "phone": "+15125550101"})
    assert r.status_code in (200, 201), r.text
    # approve via owner
    admin_s = _sess(); _login(admin_s, OWNER_EMAIL, OWNER_PW)
    u = admin_s.get(f"{API}/admin/users").json()["users"]
    uid = next(x["id"] for x in u if x["email"] == email)
    ar = admin_s.post(f"{API}/admin/users/{uid}/verification-status", json={"verification_status": "approved"})
    assert ar.status_code == 200, ar.text
    # re-login to refresh cookie
    _login(s, email, pw)
    return {"session": s, "email": email, "id": uid, "pw": pw}


# ------------------------ Seed / admin listing ------------------------
class TestSeedAndAdminList:
    def test_admin_can_list_seeded_boosts(self, admin):
        r = admin.get(f"{API}/admin/boost-types")
        assert r.status_code == 200
        data = r.json()
        assert data["feature_enabled"] is True
        names = {b["name"] for b in data["boost_types"]}
        assert {"3-Day Boost", "7-Day Boost", "Until Sold"}.issubset(names)
        by_name = {b["name"]: b for b in data["boost_types"]}
        assert by_name["3-Day Boost"]["price"] == 9.0
        assert by_name["7-Day Boost"]["price"] == 19.0
        assert by_name["Until Sold"]["price"] == 29.0
        assert by_name["Until Sold"]["until_sold"] is True

    def test_non_admin_denied_admin_endpoints(self, member):
        s = member["session"]
        assert s.get(f"{API}/admin/boost-types").status_code == 403
        assert s.post(f"{API}/admin/boost-types", json={"name": "x", "price": 1, "duration_days": 1}).status_code == 403
        assert s.put(f"{API}/admin/boost-feature", json={"enabled": False}).status_code == 403


# ------------------------ CRUD ------------------------
class TestBoostCRUD:
    def test_create_edit_hide_deactivate_delete(self, admin):
        # create
        r = admin.post(f"{API}/admin/boost-types", json={"name": "TEST_14d", "price": 14.0, "duration_days": 14})
        assert r.status_code == 200, r.text
        b = r.json()
        bid = b["id"]
        assert b["name"] == "TEST_14d" and b["price"] == 14.0 and b["duration_days"] == 14
        # edit
        r = admin.put(f"{API}/admin/boost-types/{bid}", json={"name": "TEST_14d_v2", "price": 15.5, "duration_days": 14})
        assert r.status_code == 200
        assert r.json()["price"] == 15.5 and r.json()["name"] == "TEST_14d_v2"
        # hide
        r = admin.put(f"{API}/admin/boost-types/{bid}", json={"name": "TEST_14d_v2", "price": 15.5, "duration_days": 14, "hidden": True})
        assert r.status_code == 200 and r.json()["hidden"] is True
        # deactivate
        r = admin.put(f"{API}/admin/boost-types/{bid}", json={"name": "TEST_14d_v2", "price": 15.5, "duration_days": 14, "hidden": True, "active": False})
        assert r.status_code == 200 and r.json()["active"] is False
        # delete
        r = admin.delete(f"{API}/admin/boost-types/{bid}")
        assert r.status_code == 200
        # verify gone
        listing = admin.get(f"{API}/admin/boost-types").json()["boost_types"]
        assert bid not in [x["id"] for x in listing]

    def test_create_without_duration_or_untilsold_returns_400(self, admin):
        r = admin.post(f"{API}/admin/boost-types", json={"name": "TEST_bad", "price": 5.0})
        assert r.status_code == 400

    def test_create_until_sold_ok(self, admin):
        r = admin.post(f"{API}/admin/boost-types", json={"name": "TEST_us", "price": 0.0, "until_sold": True})
        assert r.status_code == 200
        b = r.json()
        assert b["until_sold"] is True and b["duration_days"] is None
        admin.delete(f"{API}/admin/boost-types/{b['id']}")


# ------------------------ Feature toggle & visibility ------------------------
class TestFeatureToggleAndHidden:
    def test_toggle_hides_from_seller_and_persists(self, admin, member):
        # disable
        r = admin.put(f"{API}/admin/boost-feature", json={"enabled": False})
        assert r.status_code == 200 and r.json()["enabled"] is False
        r = member["session"].get(f"{API}/boost/options")
        assert r.status_code == 200
        data = r.json()
        assert data["feature_enabled"] is False
        assert data["boost_types"] == []
        # re-enable
        r = admin.put(f"{API}/admin/boost-feature", json={"enabled": True})
        assert r.status_code == 200 and r.json()["enabled"] is True
        r = member["session"].get(f"{API}/boost/options")
        assert r.json()["feature_enabled"] is True
        assert len(r.json()["boost_types"]) >= 3

    def test_hidden_boosts_absent_from_seller_but_visible_to_admin(self, admin, member):
        # create a hidden boost
        r = admin.post(f"{API}/admin/boost-types", json={"name": "TEST_hidden", "price": 3, "duration_days": 2, "hidden": True})
        bid = r.json()["id"]
        admin_ids = [x["id"] for x in admin.get(f"{API}/admin/boost-types").json()["boost_types"]]
        seller_ids = [x["id"] for x in member["session"].get(f"{API}/boost/options").json()["boost_types"]]
        assert bid in admin_ids
        assert bid not in seller_ids
        admin.delete(f"{API}/admin/boost-types/{bid}")

    def test_unverified_denied_options(self):
        # anonymous
        r = requests.get(f"{API}/boost/options")
        assert r.status_code in (401, 403)


# ------------------------ Checkout ------------------------
@pytest.fixture(scope="module")
def owner_listing(admin):
    """Create a live listing owned by OWNER (admin) for boost checkout tests."""
    # need a category
    cats = admin.get(f"{API}/categories").json()["categories"]
    slug = cats[0]["slug"]
    payload = {
        "title": "TEST_boost_listing", "category": slug, "condition": "Good",
        "location": "Austin, TX", "price": 100.0, "description": "test",
        "photos": ["/api/files/placeholder.jpg"], "publish": True,
    }
    r = admin.post(f"{API}/listings", json=payload)
    assert r.status_code in (200, 201), r.text
    lid = r.json()["id"]
    yield lid
    admin.delete(f"{API}/listings/{lid}")


class TestBoostCheckout:
    def test_owner_gets_stripe_checkout_url(self, admin, owner_listing):
        # Use the seeded 3-Day boost ($9)
        opts = admin.get(f"{API}/admin/boost-types").json()["boost_types"]
        b3 = next(b for b in opts if b["name"] == "3-Day Boost")
        r = admin.post(f"{API}/listings/{owner_listing}/boost/checkout",
                       json={"boost_type_id": b3["id"], "origin_url": BASE})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data and "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com/")

    def test_non_owner_denied(self, member, owner_listing):
        opts = member["session"].get(f"{API}/boost/options").json()["boost_types"]
        r = member["session"].post(f"{API}/listings/{owner_listing}/boost/checkout",
                                    json={"boost_type_id": opts[0]["id"], "origin_url": BASE})
        assert r.status_code == 403

    def test_free_path_applies_boost_and_marks_featured(self, admin, owner_listing):
        # create a $0 duration_days=1 boost as admin
        r = admin.post(f"{API}/admin/boost-types",
                       json={"name": "TEST_free_boost", "price": 0.0, "duration_days": 1})
        assert r.status_code == 200
        bid = r.json()["id"]
        try:
            r = admin.post(f"{API}/listings/{owner_listing}/boost/checkout",
                           json={"boost_type_id": bid, "origin_url": BASE})
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("free") is True
            # verify featured
            l = admin.get(f"{API}/listings/{owner_listing}").json()
            assert l.get("featured") is True
            # appears in ?featured=true
            feed = admin.get(f"{API}/listings", params={"featured": "true"}).json()
            arr = feed.get("listings") if isinstance(feed, dict) else feed
            assert any(x["id"] == owner_listing for x in arr)
        finally:
            admin.delete(f"{API}/admin/boost-types/{bid}")

    def test_payment_status_unauth_and_pending(self, admin, owner_listing):
        # Create a real Stripe session via checkout, then hit /payments/status unauth
        opts = admin.get(f"{API}/admin/boost-types").json()["boost_types"]
        b7 = next(b for b in opts if b["name"] == "7-Day Boost")
        r = admin.post(f"{API}/listings/{owner_listing}/boost/checkout",
                       json={"boost_type_id": b7["id"], "origin_url": BASE})
        assert r.status_code == 200
        sid = r.json()["session_id"]
        # unauth request
        r = requests.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == sid
        assert data["kind"] == "boost"
        assert data["payment_status"] in ("pending", "unpaid")
        # Confirm listing has not been re-boosted from this pending session (still featured from earlier free path is ok)


# ------------------------ Lane A stays off-Stripe ------------------------
class TestLaneASeparation:
    def test_buy_now_creates_no_stripe_session(self, admin, member):
        # member has no listings; create one as member first? Simplest: use owner_listing style buy-now
        # Create a fresh listing owned by member
        cats = admin.get(f"{API}/categories").json()["categories"]
        slug = cats[0]["slug"]
        r = member["session"].post(f"{API}/listings", json={
            "title": "TEST_lanea", "category": slug, "condition": "Good", "location": "X",
            "price": 50.0, "description": "d", "photos": ["/api/files/x.jpg"], "publish": True,
        })
        assert r.status_code in (200, 201), r.text
        lid = r.json()["id"]
        # Buyer = admin
        r = admin.post(f"{API}/listings/{lid}/buy-now", json={})
        # We expect it to succeed as off-platform handoff (no stripe url)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        text_body = str(body).lower()
        assert "checkout.stripe.com" not in text_body
        # cleanup
        member["session"].delete(f"{API}/listings/{lid}")
