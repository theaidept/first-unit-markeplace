"""Phase 3 — profiles, undercover privacy, separated identity NO-LEAK guarantee."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://first-responders-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@firstunit.us"
ADMIN_PASSWORD = "FirstUnit#Admin2026!"

# Public profile allowed keys (avatar_raw only allowed on /profile/me for own view)
PUBLIC_ALLOWED = {
    "id", "user_id", "display_handle", "photo_visibility", "avatar", "initials",
    "agency", "rank", "years_of_service", "verified_badge", "undercover",
    "responder_type", "service_status",
}
FORBIDDEN_KEYS = {
    "credential_number", "provider_reference", "prescreen", "real_name",
    "provider", "outcome", "password_hash",
}


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


def _register(s, email, password, phone="+15551234567"):
    return s.post(f"{API}/auth/register", json={"email": email, "password": password, "phone": phone})


def _assert_public_only(obj, allow_avatar_raw=False):
    keys = set(obj.keys())
    allowed = PUBLIC_ALLOWED | ({"avatar_raw"} if allow_avatar_raw else set())
    extra = keys - allowed
    forbidden = keys & FORBIDDEN_KEYS
    assert not forbidden, f"Forbidden keys leaked: {forbidden}"
    # extra keys not allowed either - strict
    assert not extra, f"Unexpected keys in public payload: {extra}"


@pytest.fixture(scope="module")
def admin_session():
    s = _session()
    r = _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def approved_member(admin_session):
    """Register a fresh member, admin-approve, return (session, user_id, email)."""
    email = f"TEST_member_{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!"
    s = _session()
    r = _register(s, email, password)
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    user_id = r.json()["id"]
    # admin approves
    ar = admin_session.post(
        f"{API}/admin/users/{user_id}/verification-status",
        json={"verification_status": "approved"},
    )
    assert ar.status_code == 200, ar.text
    # re-login (verification_status in cookie unchanged but require_verified reads from DB, ok)
    return {"session": s, "user_id": user_id, "email": email, "password": password}


@pytest.fixture(scope="module")
def approved_member_2(admin_session):
    email = f"TEST_member_{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!"
    s = _session()
    r = _register(s, email, password)
    assert r.status_code == 200
    user_id = r.json()["id"]
    admin_session.post(
        f"{API}/admin/users/{user_id}/verification-status",
        json={"verification_status": "approved"},
    )
    return {"session": s, "user_id": user_id, "email": email}


# ---------------- NO-LEAK tests ----------------
class TestNoLeakGuarantee:
    def test_profile_me_returns_only_public(self, approved_member):
        r = approved_member["session"].get(f"{API}/profile/me")
        assert r.status_code == 200, r.text
        data = r.json()
        _assert_public_only(data, allow_avatar_raw=True)

    def test_members_list_public_only(self, approved_member):
        r = approved_member["session"].get(f"{API}/members")
        assert r.status_code == 200
        data = r.json()
        assert "members" in data
        for m in data["members"]:
            _assert_public_only(m, allow_avatar_raw=False)

    def test_profiles_by_id_public_only(self, approved_member, approved_member_2):
        r = approved_member["session"].get(f"{API}/profiles/{approved_member_2['user_id']}")
        assert r.status_code == 200, r.text
        _assert_public_only(r.json(), allow_avatar_raw=False)


# ---------------- Default privacy ----------------
class TestDefaultPrivacy:
    def test_new_member_default_avatar_visibility(self, admin_session):
        # fresh member — check defaults BEFORE any updates
        email = f"TEST_default_{uuid.uuid4().hex[:8]}@example.com"
        s = _session()
        r = _register(s, email, "Passw0rd!")
        assert r.status_code == 200
        uid = r.json()["id"]
        admin_session.post(
            f"{API}/admin/users/{uid}/verification-status",
            json={"verification_status": "approved"},
        )
        r = s.get(f"{API}/profile/me")
        data = r.json()
        assert data["photo_visibility"] == "avatar"
        assert data["avatar"] is None
        assert data["undercover"] is False


# ---------------- PUT /profile/me ----------------
class TestProfileUpdate:
    def test_update_basic_fields(self, approved_member):
        s = approved_member["session"]
        r = s.put(f"{API}/profile/me", json={
            "display_handle": "Engine 14",
            "agency": "City FD",
            "rank": "Firefighter",
            "years_of_service": "6",
            "photo_visibility": "initials",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["display_handle"] == "Engine 14"
        assert d["agency"] == "City FD"
        assert d["photo_visibility"] == "initials"
        assert d["initials"] == "E1"
        # verify persistence via GET
        r2 = s.get(f"{API}/profile/me")
        assert r2.json()["display_handle"] == "Engine 14"

    def test_empty_handle_rejected(self, approved_member):
        r = approved_member["session"].put(f"{API}/profile/me", json={"display_handle": "   "})
        assert r.status_code == 400

    def test_invalid_photo_visibility_rejected(self, approved_member):
        r = approved_member["session"].put(f"{API}/profile/me", json={"photo_visibility": "public"})
        assert r.status_code == 400


# ---------------- Undercover acceptance ----------------
class TestUndercover:
    def test_undercover_with_initials(self, approved_member):
        s = approved_member["session"]
        r = s.put(f"{API}/profile/me", json={
            "display_handle": "PD Unit 22",
            "undercover": True,
            "photo_visibility": "initials",
            "avatar": "https://example.com/photo.jpg",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["undercover"] is True
        assert d["avatar"] is None  # suppressed
        assert d["verified_badge"] is True
        assert d["initials"] == "PU"

    def test_photo_visibility_photo_but_undercover_suppresses(self, approved_member):
        s = approved_member["session"]
        r = s.put(f"{API}/profile/me", json={
            "undercover": True,
            "photo_visibility": "photo",
            "avatar": "https://example.com/photo.jpg",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["undercover"] is True
        assert d["avatar"] is None  # SUPPRESSED even though photo_visibility=photo
        assert d["verified_badge"] is True

    def test_photo_shown_when_not_undercover(self, approved_member):
        s = approved_member["session"]
        r = s.put(f"{API}/profile/me", json={
            "undercover": False,
            "photo_visibility": "photo",
            "avatar": "https://example.com/photo.jpg",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["avatar"] == "https://example.com/photo.jpg"


# ---------------- Verified-only gate ----------------
class TestVerifiedGate:
    def test_unauth_profile_me(self):
        r = requests.get(f"{API}/profile/me")
        assert r.status_code == 401

    def test_unauth_members(self):
        r = requests.get(f"{API}/members")
        assert r.status_code == 401

    def test_unauth_profiles_by_id(self, approved_member):
        r = requests.get(f"{API}/profiles/{approved_member['user_id']}")
        assert r.status_code == 401

    def test_unauth_put_profile(self):
        r = requests.put(f"{API}/profile/me", json={"display_handle": "x"})
        assert r.status_code == 401

    def test_unverified_member_gated(self, approved_member):
        # create fresh unverified member
        email = f"TEST_unver_{uuid.uuid4().hex[:8]}@example.com"
        s = _session()
        r = _register(s, email, "Passw0rd!")
        assert r.status_code == 200
        # not approved
        assert s.get(f"{API}/profile/me").status_code == 403
        assert s.get(f"{API}/members").status_code == 403
        assert s.get(f"{API}/profiles/{approved_member['user_id']}").status_code == 403
        assert s.put(f"{API}/profile/me", json={"display_handle": "x"}).status_code == 403
