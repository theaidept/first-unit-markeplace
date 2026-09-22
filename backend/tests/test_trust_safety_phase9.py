"""Phase 9 — Trust & Safety: reporting, admin moderation, consolidated console health, audit."""
import os
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
BUYER_ID = "9b48d746-b287-4b48-8e50-82ecbdd42940"
STATE = {}


def _session(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_s():
    return _session(OWNER)


@pytest.fixture(scope="module")
def buyer_s():
    # Ensure buyer2 is approved before we start (in case a prior test left it suspended)
    s = _session(OWNER)
    s.post(f"{API}/admin/users/{BUYER_ID}/moderate", json={"action": "reinstate", "reason": "TEST_ setup"}, timeout=15)
    return _session(BUYER)


@pytest.fixture(scope="module")
def owner_id(admin_s):
    r = admin_s.get(f"{API}/auth/me", timeout=15)
    return r.json()["id"]


@pytest.fixture(scope="module")
def target_listing(admin_s):
    # Prefer 'Duty Belt Set' by known id
    lid = "4629612b-dc5e-4f99-b59e-0b0107198483"
    r = admin_s.get(f"{API}/listings/{lid}", timeout=15)
    if r.status_code == 200:
        return r.json()
    r = admin_s.get(f"{API}/listings", timeout=15)
    data = r.json()
    ls = data.get("listings") if isinstance(data, dict) else data
    return ls[0]


# ------------------- Reporting -------------------
class TestReporting:
    def test_report_listing_ok(self, buyer_s, target_listing):
        r = buyer_s.post(f"{API}/reports", json={
            "target_type": "listing", "target_id": target_listing["id"],
            "reason": "prohibited_item", "note": "TEST_ phase9 listing report"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    def test_report_user_ok(self, buyer_s, owner_id):
        r = buyer_s.post(f"{API}/reports", json={
            "target_type": "user", "target_id": owner_id,
            "reason": "harassment", "note": "TEST_ phase9 user report"}, timeout=15)
        assert r.status_code == 200, r.text

    def test_report_self_400(self, buyer_s):
        r = buyer_s.post(f"{API}/reports", json={
            "target_type": "user", "target_id": BUYER_ID,
            "reason": "spam", "note": "TEST_ self"}, timeout=15)
        assert r.status_code == 400

    def test_report_invalid_reason_400(self, buyer_s, target_listing):
        r = buyer_s.post(f"{API}/reports", json={
            "target_type": "listing", "target_id": target_listing["id"],
            "reason": "not_a_reason"}, timeout=15)
        assert r.status_code == 400

    def test_report_invalid_target_type_400(self, buyer_s, target_listing):
        r = buyer_s.post(f"{API}/reports", json={
            "target_type": "random", "target_id": target_listing["id"],
            "reason": "spam"}, timeout=15)
        assert r.status_code in (400, 422)


# ------------------- Admin reports queue -------------------
class TestAdminReportsQueue:
    def test_admin_lists_reports(self, admin_s):
        r = admin_s.get(f"{API}/admin/reports", timeout=15)
        assert r.status_code == 200
        reports = r.json()["reports"]
        assert isinstance(reports, list) and len(reports) >= 1
        # Open first ordering
        statuses = [x.get("status") for x in reports]
        first_open = statuses.index("open") if "open" in statuses else 0
        for s in statuses[:first_open]:
            assert s == "open"  # shouldn't happen if any open
        # Enrichment
        has_reporter = all("reporter" in r for r in reports)
        assert has_reporter
        # capture one open listing/user report id for later
        for rep in reports:
            if rep["status"] == "open" and rep["target_type"] == "user":
                STATE["open_user_report_id"] = rep["id"]
            if rep["status"] == "open" and rep["target_type"] == "listing":
                STATE["open_listing_report_id"] = rep["id"]
                STATE["report_listing_id"] = rep.get("listing_id") or rep.get("target_id")

    def test_non_admin_reports_forbidden(self, buyer_s):
        r = buyer_s.get(f"{API}/admin/reports", timeout=15)
        assert r.status_code == 403


# ------------------- Report status transitions -------------------
class TestReportStatus:
    def test_invalid_status_400(self, admin_s):
        rid = STATE.get("open_user_report_id")
        if not rid:
            pytest.skip("no open user report")
        r = admin_s.post(f"{API}/admin/reports/{rid}/status",
                         json={"status": "closed", "note": "bad"}, timeout=15)
        assert r.status_code == 400

    def test_mark_reviewing_then_dismiss(self, admin_s):
        rid = STATE.get("open_user_report_id")
        if not rid:
            pytest.skip("no open user report")
        r = admin_s.post(f"{API}/admin/reports/{rid}/status",
                         json={"status": "reviewing"}, timeout=15)
        assert r.status_code == 200 and r.json()["report_status"] == "reviewing"
        r = admin_s.post(f"{API}/admin/reports/{rid}/status",
                         json={"status": "dismissed", "note": "TEST_"}, timeout=15)
        assert r.status_code == 200

        # Verify persisted
        rr = admin_s.get(f"{API}/admin/reports/{rid}", timeout=15).json()
        assert rr["status"] == "dismissed"
        assert rr.get("reviewer")


# ------------------- Listing moderation -------------------
class TestListingModeration:
    def test_admin_list_listings(self, admin_s):
        r = admin_s.get(f"{API}/admin/listings", timeout=15)
        assert r.status_code == 200
        assert "listings" in r.json()

    def test_non_admin_listings_forbidden(self, buyer_s):
        assert buyer_s.get(f"{API}/admin/listings", timeout=15).status_code == 403

    def test_remove_then_reinstate_and_reports_auto_actioned(self, admin_s, target_listing):
        lid = target_listing["id"]
        # ensure at least one open report exists on this listing
        # (Reporting test above created one)
        r = admin_s.post(f"{API}/admin/listings/{lid}/moderate",
                         json={"action": "remove", "reason": "TEST_ p9"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["listing_status"] == "removed"

        # verify listing status
        rr = admin_s.get(f"{API}/admin/listings", timeout=15).json()["listings"]
        found = next((x for x in rr if x["id"] == lid), None)
        assert found and found["status"] == "removed"

        # verify open reports on this listing were auto-actioned
        reps = admin_s.get(f"{API}/admin/reports", timeout=15).json()["reports"]
        listing_reports = [x for x in reps if (x.get("listing_id") == lid) and x["target_type"] == "listing"]
        # after removal none should still be open
        assert all(x["status"] != "open" for x in listing_reports)

        # invalid action
        rbad = admin_s.post(f"{API}/admin/listings/{lid}/moderate",
                            json={"action": "explode"}, timeout=15)
        assert rbad.status_code == 400

        # reinstate
        r2 = admin_s.post(f"{API}/admin/listings/{lid}/moderate",
                          json={"action": "reinstate"}, timeout=15)
        assert r2.status_code == 200 and r2.json()["listing_status"] == "live"


# ------------------- User moderation + suspend gate -------------------
class TestUserModeration:
    def test_cannot_moderate_admin(self, admin_s, owner_id):
        r = admin_s.post(f"{API}/admin/users/{owner_id}/moderate",
                         json={"action": "suspend", "reason": "TEST_"}, timeout=15)
        assert r.status_code == 400

    def test_warn_user(self, admin_s):
        r = admin_s.post(f"{API}/admin/users/{BUYER_ID}/moderate",
                         json={"action": "warn", "reason": "TEST_ warning"}, timeout=15)
        assert r.status_code == 200

    def test_suspend_revokes_access_then_reinstate(self, admin_s):
        # buyer session must be active before we suspend
        bs = _session(BUYER)
        # confirm access first
        pre = bs.get(f"{API}/marketplace/summary", timeout=15)
        assert pre.status_code == 200, pre.text

        r = admin_s.post(f"{API}/admin/users/{BUYER_ID}/moderate",
                         json={"action": "suspend", "reason": "TEST_ suspend"}, timeout=15)
        assert r.status_code == 200 and r.json()["verification_status"] == "suspended"

        # Now the same cookie session should be blocked
        post = bs.get(f"{API}/marketplace/summary", timeout=15)
        assert post.status_code == 403, f"expected 403 after suspend, got {post.status_code}"
        listing_post = bs.get(f"{API}/listings", timeout=15)
        assert listing_post.status_code == 403

        # Reinstate
        r2 = admin_s.post(f"{API}/admin/users/{BUYER_ID}/moderate",
                          json={"action": "reinstate"}, timeout=15)
        assert r2.status_code == 200 and r2.json()["verification_status"] == "approved"

        # Access restored
        bs2 = _session(BUYER)
        assert bs2.get(f"{API}/marketplace/summary", timeout=15).status_code == 200

    def test_invalid_moderate_action(self, admin_s):
        r = admin_s.post(f"{API}/admin/users/{BUYER_ID}/moderate",
                         json={"action": "banhammer"}, timeout=15)
        assert r.status_code == 400


# ------------------- Manual verification override lockdown -------------------
class TestVerificationOverride:
    def test_no_reason_400(self, admin_s):
        r = admin_s.post(f"{API}/admin/users/{BUYER_ID}/verification-status",
                         json={"verification_status": "approved"}, timeout=15)
        assert r.status_code == 400

    def test_empty_reason_400(self, admin_s):
        r = admin_s.post(f"{API}/admin/users/{BUYER_ID}/verification-status",
                         json={"verification_status": "approved", "note": "   "}, timeout=15)
        assert r.status_code == 400

    def test_with_reason_audits(self, admin_s):
        r = admin_s.post(f"{API}/admin/users/{BUYER_ID}/verification-status",
                         json={"verification_status": "approved", "note": "TEST_ manual override phase9"}, timeout=15)
        assert r.status_code == 200

        log = admin_s.get(f"{API}/admin/audit-log", timeout=15).json()["actions"]
        recent = [a for a in log if a.get("action") == "manual_verification_override"]
        assert recent, "expected manual_verification_override audit entry"
        assert recent[0].get("admin_email")


# ------------------- Health counts (real data) -------------------
class TestHealth:
    def test_health_structure(self, admin_s):
        r = admin_s.get(f"{API}/admin/health", timeout=15)
        assert r.status_code == 200
        h = r.json()
        for k in ("verification", "listings", "reports", "signups", "verification_throughput_7d", "listing_activity_7d"):
            assert k in h
        for k in ("open", "reviewing", "actioned", "dismissed"):
            assert k in h["reports"]
        for k in ("live", "flagged", "removed", "sold", "draft", "total"):
            assert k in h["listings"]

    def test_open_reports_matches_query(self, admin_s):
        h = admin_s.get(f"{API}/admin/health", timeout=15).json()
        reps = admin_s.get(f"{API}/admin/reports", timeout=15).json()["reports"]
        actual_open = sum(1 for r in reps if r["status"] == "open")
        assert h["reports"]["open"] == actual_open

    def test_non_admin_health_forbidden(self, buyer_s):
        assert buyer_s.get(f"{API}/admin/health", timeout=15).status_code == 403


# ------------------- Admin-only enforcement blanket -------------------
class TestAdminOnly:
    ROUTES = [
        ("GET", "/admin/users"),
        ("GET", "/admin/reports"),
        ("GET", "/admin/listings"),
        ("GET", "/admin/audit-log"),
        ("GET", "/admin/health"),
    ]

    def test_non_admin_verified_403(self, buyer_s):
        for method, path in self.ROUTES:
            r = buyer_s.request(method, f"{API}{path}", timeout=15)
            assert r.status_code == 403, f"{method} {path} expected 403 got {r.status_code}"

    def test_unauth_401_or_403(self):
        s = requests.Session()
        for method, path in self.ROUTES:
            r = s.request(method, f"{API}{path}", timeout=15)
            assert r.status_code in (401, 403), f"{method} {path} got {r.status_code}"


# ------------------- Regression: verified-only gate + phase 8 messaging still works -------------------
class TestRegression:
    def test_verified_can_get_marketplace(self, buyer_s):
        assert buyer_s.get(f"{API}/marketplace/summary", timeout=15).status_code == 200

    def test_listing_detail_public_accessible(self, buyer_s, target_listing):
        r = buyer_s.get(f"{API}/listings/{target_listing['id']}", timeout=15)
        assert r.status_code == 200
