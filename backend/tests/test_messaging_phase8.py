"""Phase 8 — verified-only buyer↔seller messaging + reporting."""
import os
import uuid
import requests
import pytest

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"email": "theaidept@gmail.com", "password": "FirstUnit#Owner2026!"}
BUYER = {"email": "buyer2@example.com", "password": "BuyerPass#2026"}
STATE = {}


def _session(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def owner_s():
    return _session(OWNER)


@pytest.fixture(scope="module")
def buyer_s():
    return _session(BUYER)


@pytest.fixture(scope="module")
def owner_listing(owner_s):
    r = owner_s.get(f"{API}/listings/mine", timeout=15)
    assert r.status_code == 200
    data = r.json()
    listings = data.get("listings") if isinstance(data, dict) else data
    assert listings, "owner has no listings to test messaging against"
    # prefer an active/available listing
    return next((l for l in listings if l.get("status") == "active"), listings[0])


# --- Verified-only gate -----------------------------------------------------

class TestVerifiedGate:
    def test_unauthenticated_threads_forbidden(self):
        # No cookie => auth middleware returns 401 or 403
        r = requests.get(f"{API}/threads", timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_unverified_user_blocked(self):
        # Register a brand new member (unverified by default)
        email = f"TEST_unverified_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        reg = s.post(f"{API}/auth/register",
                     json={"email": email, "password": "StrongPass#2026", "phone": "+15555550100"},
                     timeout=15)
        assert reg.status_code in (200, 201), reg.text
        # These endpoints must all 403 for unverified
        for path in ["/threads", "/messages/unread-count", "/notifications"]:
            r = s.get(f"{API}{path}", timeout=15)
            assert r.status_code == 403, f"{path} expected 403, got {r.status_code} {r.text}"
        r = s.post(f"{API}/threads", json={"listing_id": "x"}, timeout=15)
        assert r.status_code == 403, r.text


# --- Full flow --------------------------------------------------------------

class TestMessagingFlow:
    def test_start_thread_from_listing(self, buyer_s, owner_listing):
        r = buyer_s.post(f"{API}/threads",
                         json={"listing_id": owner_listing["id"], "body": "TEST_hi is this still available?"},
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["listing"]["id"] == owner_listing["id"]
        assert data["listing"]["title"] == owner_listing["title"]
        assert "display_handle" in data["other"]
        # Public handle layer — must NOT be an email or "real name"
        assert "@" not in data["other"]["display_handle"]
        STATE["tid"] = data["id"]

    def test_cannot_message_self(self, owner_s, owner_listing):
        r = owner_s.post(f"{API}/threads", json={"listing_id": owner_listing["id"]}, timeout=15)
        assert r.status_code == 400

    def test_seller_sees_thread_and_unread(self, owner_s):
        tid = STATE["tid"]
        r = owner_s.get(f"{API}/threads", timeout=15)
        assert r.status_code == 200
        threads = r.json()["threads"]
        t = next((x for x in threads if x["id"] == tid), None)
        assert t, "seller does not see the thread"
        assert t["unread_count"] >= 1
        r2 = owner_s.get(f"{API}/messages/unread-count", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["unread"] >= 1

    def test_seller_get_thread_marks_read(self, owner_s):
        tid = STATE["tid"]
        r = owner_s.get(f"{API}/threads/{tid}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["messages"], "no messages returned"
        # Now unread count should drop for owner
        r2 = owner_s.get(f"{API}/threads", timeout=15)
        t = next(x for x in r2.json()["threads"] if x["id"] == tid)
        assert t["unread_count"] == 0

    def test_seller_replies_buyer_sees(self, owner_s, buyer_s):
        tid = STATE["tid"]
        r = owner_s.post(f"{API}/threads/{tid}/messages",
                         json={"body": "TEST_yes still available"}, timeout=15)
        assert r.status_code == 200, r.text
        # Buyer sees new unread + notification
        rc = buyer_s.get(f"{API}/messages/unread-count", timeout=15)
        assert rc.json()["unread"] >= 1
        rn = buyer_s.get(f"{API}/notifications", timeout=15)
        assert rn.status_code == 200
        notes = rn.json()["notifications"]
        assert any(n["type"] == "message" and n["thread_id"] == tid for n in notes)

    def test_non_participant_blocked(self, owner_listing):
        # Create third verified-looking user? Just register another unverified; it will 403 via gate.
        # For a participant-guard test we need a verified 3rd party — reuse admin.
        admin = _session({"email": "admin@firstunit.us", "password": "FirstUnit#Admin2026!"})
        tid = STATE["tid"]
        r = admin.get(f"{API}/threads/{tid}", timeout=15)
        assert r.status_code == 404, r.text
        r2 = admin.post(f"{API}/threads/{tid}/messages", json={"body": "hi"}, timeout=15)
        assert r2.status_code == 404


# --- Reporting --------------------------------------------------------------

class TestReporting:
    def test_invalid_reason(self, buyer_s):
        tid = STATE["tid"]
        r = buyer_s.post(f"{API}/threads/{tid}/report",
                        json={"reason": "bogus_reason"}, timeout=15)
        assert r.status_code == 400

    def test_valid_report_creates_record(self, buyer_s):
        tid = STATE["tid"]
        r = buyer_s.post(f"{API}/threads/{tid}/report",
                        json={"reason": "scam_fraud", "note": "TEST_looks like a scam"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    @pytest.mark.parametrize("code", ["scam_fraud", "prohibited_item", "harassment", "spam", "other"])
    def test_all_valid_reason_codes(self, buyer_s, code):
        tid = STATE["tid"]
        r = buyer_s.post(f"{API}/threads/{tid}/report", json={"reason": code}, timeout=15)
        assert r.status_code == 200
