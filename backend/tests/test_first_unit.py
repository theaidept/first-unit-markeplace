"""First Unit Phase 1 backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://first-responders-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@firstunit.us"
ADMIN_PASSWORD = "FirstUnit#Admin2026!"


def _new_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def s():
    return requests.Session()


@pytest.fixture
def admin_session():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return sess


@pytest.fixture
def member_session():
    sess = requests.Session()
    email = _new_email()
    r = sess.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "5551234567"})
    assert r.status_code == 200, r.text
    sess.email = email
    sess.user_id = r.json()["id"]
    return sess


# --- Auth ---
class TestAuth:
    def test_register_creates_unverified_user(self, s):
        email = _new_email()
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "5551234567"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == email
        assert data["verification_status"] == "unverified"
        assert data["role"] == "member"
        assert "password_hash" not in data
        # cookie set
        assert "access_token" in s.cookies

    def test_register_duplicate(self, s):
        email = _new_email()
        s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "5551234567"})
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "5551234567"})
        assert r.status_code == 400

    def test_register_short_password(self, s):
        r = s.post(f"{API}/auth/register", json={"email": _new_email(), "password": "short", "phone": "5551234567"})
        assert r.status_code == 422

    def test_login_admin(self):
        sess = requests.Session()
        r = sess.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        assert r.json()["verification_status"] == "approved"

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_via_cookie(self, member_session):
        r = member_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == member_session.email

    def test_logout_clears_session(self, member_session):
        r = member_session.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # New session should not be authenticated
        member_session.cookies.clear()
        r2 = member_session.get(f"{API}/auth/me")
        assert r2.status_code == 401

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Verified-only Gate ---
class TestVerifiedGate:
    def test_marketplace_unauth_401(self):
        r = requests.get(f"{API}/marketplace/summary")
        assert r.status_code == 401

    def test_members_unauth_401(self):
        r = requests.get(f"{API}/members")
        assert r.status_code == 401

    def test_marketplace_unverified_403(self, member_session):
        r = member_session.get(f"{API}/marketplace/summary")
        assert r.status_code == 403

    def test_members_unverified_403(self, member_session):
        r = member_session.get(f"{API}/members")
        assert r.status_code == 403

    def test_admin_marketplace_access(self, admin_session):
        r = admin_session.get(f"{API}/marketplace/summary")
        assert r.status_code == 200
        assert "listings" in r.json()


# --- Admin routes ---
class TestAdmin:
    def test_admin_list_users(self, admin_session):
        r = admin_session.get(f"{API}/admin/users")
        assert r.status_code == 200
        assert "users" in r.json()
        for u in r.json()["users"]:
            assert "password_hash" not in u

    def test_member_cannot_access_admin(self, member_session):
        r = member_session.get(f"{API}/admin/users")
        assert r.status_code == 403

    def test_approve_flow(self, admin_session, member_session):
        uid = member_session.user_id
        # approve
        r = admin_session.post(f"{API}/admin/users/{uid}/verification-status",
                               json={"verification_status": "approved"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "approved"
        # member now can access marketplace
        r2 = member_session.get(f"{API}/marketplace/summary")
        assert r2.status_code == 200
        # verification event logged
        r3 = member_session.get(f"{API}/verification/me")
        assert r3.status_code == 200
        vdata = r3.json()
        assert vdata["verification_status"] == "approved"
        events = vdata["events"]
        assert any(e.get("reviewer") == "Trust & Safety Team" and e.get("status") == "Approved" for e in events)
        # verification record does not store raw credential docs
        rec = vdata["record"]
        allowed = {"id", "user_id", "current_state", "provider", "provider_reference",
                   "outcome", "created_at", "updated_at"}
        assert set(rec.keys()).issubset(allowed), f"Unexpected keys: {set(rec.keys()) - allowed}"

    def test_set_status_user_not_found(self, admin_session):
        r = admin_session.post(f"{API}/admin/users/not-a-real-id/verification-status",
                               json={"verification_status": "approved"})
        assert r.status_code == 404


# --- Password reset ---
class TestPasswordReset:
    def test_forgot_password_no_enumeration(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nonexistent_xyz@example.com"})
        assert r.status_code == 200
        assert "message" in r.json()

    def test_forgot_password_existing(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code == 200

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid-token", "password": "Newpass123!"})
        assert r.status_code == 400


# --- Verification /me ---
class TestVerificationMe:
    def test_verification_me_unverified(self, member_session):
        r = member_session.get(f"{API}/verification/me")
        assert r.status_code == 200
        d = r.json()
        assert d["verification_status"] == "unverified"
        assert d["record"]["current_state"] == "unverified"
