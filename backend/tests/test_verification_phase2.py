"""First Unit Phase 2 verification tests (mock ID.me provider)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@firstunit.us"
ADMIN_PASSWORD = "FirstUnit#Admin2026!"


def _new_email():
    return f"test_p2_{uuid.uuid4().hex[:10]}@example.com"


def _register(sess):
    email = _new_email()
    r = sess.post(f"{API}/auth/register",
                  json={"email": email, "password": "Passw0rd!", "phone": "5551234567"})
    assert r.status_code == 200, r.text
    sess.email = email
    sess.user_id = r.json()["id"]
    return sess


@pytest.fixture
def member():
    return _register(requests.Session())


@pytest.fixture
def admin():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return sess


def _submit(sess, cred, agency="Austin FD", rank="Lieutenant", years="8"):
    return sess.post(f"{API}/verification/submit", json={
        "responder_type": "firefighter_career",
        "service_status": "active",
        "agency": agency,
        "credential_number": cred,
        "rank": rank,
        "years_of_service": years,
    })


# --- Config ---
class TestConfig:
    def test_config_returns_idme_mock(self, member):
        r = member.get(f"{API}/verification/config")
        assert r.status_code == 200
        d = r.json()
        assert d["provider"] == "idme"
        assert d["oauth"] is False


# --- Submit flow ---
class TestSubmitMock:
    def test_normal_credential_auto_approves(self, member):
        r = _submit(member, "BADGE123")
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "result"
        assert d["verification_status"] == "approved"
        # marketplace now accessible
        r2 = member.get(f"{API}/marketplace/summary")
        assert r2.status_code == 200

    def test_review_credential_routes_to_review(self, member):
        r = _submit(member, "REVIEW-1")
        assert r.status_code == 200
        assert r.json()["verification_status"] == "human_review"
        # still blocked from marketplace
        r2 = member.get(f"{API}/marketplace/summary")
        assert r2.status_code == 403

    def test_fail_credential_rejected(self, member):
        r = _submit(member, "FAIL-1")
        assert r.status_code == 200
        assert r.json()["verification_status"] == "rejected"
        r2 = member.get(f"{API}/marketplace/summary")
        assert r2.status_code == 403

    def test_approved_cannot_resubmit(self, member):
        _submit(member, "BADGE999")
        r = _submit(member, "BADGE999")
        assert r.status_code == 400


# --- Admin queue + decision ---
class TestAdminQueue:
    def test_review_appears_in_queue_with_prescreen(self, member, admin):
        _submit(member, "REVIEW-Q1", agency="Dallas PD", rank="Sergeant", years="12")
        r = admin.get(f"{API}/admin/verification-queue")
        assert r.status_code == 200
        queue = r.json()["queue"]
        case = next((c for c in queue if c["email"] == member.email), None)
        assert case is not None, f"case not found in queue: {[c['email'] for c in queue]}"
        # Contains member-entered fields (prescreen)
        assert case["prescreen"]["agency"] == "Dallas PD"
        assert case["prescreen"]["rank"] == "Sergeant"
        assert case["prescreen"]["years_of_service"] == "12"
        assert case["prescreen"]["responder_type"] == "firefighter_career"
        assert case["prescreen"]["credential_number"] == "REVIEW-Q1"
        # Provider outcome (no raw docs)
        assert case["provider"] == "idme"
        assert case["provider_reference"]
        # No raw creds/documents in queue payload
        forbidden = {"document", "credential_photo", "access_token", "userinfo"}
        assert not (set(case.keys()) & forbidden)

    def test_admin_approve_activates_account(self, member, admin):
        _submit(member, "REVIEW-A1")
        r = admin.post(f"{API}/admin/verification/{member.user_id}/decision",
                       json={"decision": "approve"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "approved"
        # member reaches marketplace
        r2 = member.get(f"{API}/marketplace/summary")
        assert r2.status_code == 200

    def test_admin_reject_blocks_account(self, member, admin):
        _submit(member, "REVIEW-R1")
        r = admin.post(f"{API}/admin/verification/{member.user_id}/decision",
                       json={"decision": "reject", "reason": "Could not confirm agency"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "rejected"
        r2 = member.get(f"{API}/marketplace/summary")
        assert r2.status_code == 403

    def test_bad_decision_400(self, member, admin):
        _submit(member, "REVIEW-B1")
        r = admin.post(f"{API}/admin/verification/{member.user_id}/decision",
                       json={"decision": "maybe"})
        assert r.status_code == 400


# --- Append-only log ---
class TestApprovalLog:
    def test_review_then_approve_log_sequence(self, member, admin):
        _submit(member, "REVIEW-L1")
        admin.post(f"{API}/admin/verification/{member.user_id}/decision",
                   json={"decision": "approve"})
        r = member.get(f"{API}/verification/me")
        assert r.status_code == 200
        events = r.json()["events"]
        seq = [(e["event"], e["reviewer"], e["status"]) for e in events]
        # Check required events present
        assert any(e == "Application submitted" and rv == "System" and st == "Received"
                   for e, rv, st in seq)
        assert any("inconclusive" in e and rv == "ID.me Gateway" and st == "In review"
                   for e, rv, st in seq)
        assert any(e == "Routed to manual review" and rv == "Trust & Safety Team"
                   for e, rv, st in seq)
        assert any(e == "Agency confirmation approved" and rv == ADMIN_EMAIL and st == "Approved"
                   for e, rv, st in seq)
        assert any(e == "Account activation" and rv == "System" and st == "Approved"
                   for e, rv, st in seq)
        # Append-only: timestamps monotonic
        ts = [e["timestamp"] for e in events]
        assert ts == sorted(ts)


# --- Data boundary ---
class TestDataBoundary:
    def test_no_raw_document_in_record(self, member, admin):
        _submit(member, "REVIEW-D1", agency="Boston FD")
        # Approve to also cover post-approval record
        admin.post(f"{API}/admin/verification/{member.user_id}/decision",
                   json={"decision": "approve"})
        r = member.get(f"{API}/verification/me")
        rec = r.json()["record"]
        allowed = {"id", "user_id", "current_state", "provider", "provider_reference",
                   "outcome", "created_at", "updated_at", "prescreen"}
        extra = set(rec.keys()) - allowed
        assert not extra, f"Unexpected keys in verification record: {extra}"
        # No raw doc / token fields
        for banned in ("access_token", "id_token", "userinfo", "document",
                       "credential_photo", "raw_payload"):
            assert banned not in rec
        # Prescreen contains only member-entered fields
        ps = rec.get("prescreen", {})
        ps_allowed = {"responder_type", "service_status", "agency",
                      "credential_number", "rank", "years_of_service"}
        assert set(ps.keys()).issubset(ps_allowed)


# --- Gate integrity ---
class TestGate:
    def test_unauth_401(self):
        r = requests.get(f"{API}/marketplace/summary")
        assert r.status_code == 401

    def test_human_review_blocked(self, member):
        _submit(member, "REVIEW-G1")
        r = member.get(f"{API}/marketplace/summary")
        assert r.status_code == 403

    def test_rejected_blocked(self, member):
        _submit(member, "FAIL-G1")
        r = member.get(f"{API}/marketplace/summary")
        assert r.status_code == 403


# --- Provider swap (code-level) ---
class TestProviderSwap:
    def test_sheerid_selectable_in_code(self):
        import importlib, sys
        os.environ["VERIFICATION_PROVIDER"] = "sheerid"
        # reload providers module to re-read env
        sys.path.insert(0, "/app/backend")
        import providers as p
        importlib.reload(p)
        try:
            assert p.get_provider().name == "sheerid"
        finally:
            os.environ["VERIFICATION_PROVIDER"] = "idme"
            importlib.reload(p)
            assert p.get_provider().name == "idme"
