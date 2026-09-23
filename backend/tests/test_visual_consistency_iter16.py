"""Iteration 16 - visual consistency pass. Validates TEST_ exclusion on listings & stories,
verified-only gate, and that basic auth+marketplace endpoints still work."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://first-responders-4.preview.emergentagent.com").rstrip("/")

OWNER = {"email": "theaidept@gmail.com", "password": "FirstUnit#Owner2026!"}
BUYER = {"email": "buyer2@example.com", "password": "BuyerPass#2026"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def owner_session():
    return _login(OWNER)


@pytest.fixture(scope="module")
def buyer_session():
    return _login(BUYER)


class TestAuth:
    def test_owner_login_and_me(self, owner_session):
        r = owner_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me.get("verification_status") == "approved"
        assert me.get("role") == "admin"

    def test_buyer_login_and_me(self, buyer_session):
        r = buyer_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json().get("verification_status") == "approved"


class TestListingsNoTestPrefix:
    def test_feed_excludes_test_prefixed(self, buyer_session):
        r = buyer_session.get(f"{BASE_URL}/api/listings", timeout=20)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("listings", []))
        assert isinstance(items, list)
        offenders = [i for i in items if re.match(r"^test_", (i.get("title") or ""), re.I)]
        assert offenders == [], f"TEST_ listings leaked into feed: {[o.get('title') for o in offenders]}"
        # Should have real seed data
        assert len(items) > 0, "expected demo listings but feed is empty"

    def test_feed_with_query_still_excludes_test(self, buyer_session):
        r = buyer_session.get(f"{BASE_URL}/api/listings?q=test", timeout=20)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("listings", []))
        offenders = [i for i in items if re.match(r"^test_", (i.get("title") or ""), re.I)]
        assert offenders == []


class TestStoriesNoTestPrefix:
    def test_stories_excludes_test(self, buyer_session):
        r = buyer_session.get(f"{BASE_URL}/api/stories", timeout=20)
        assert r.status_code in (200, 204)
        if r.status_code == 200 and r.text:
            data = r.json()
            items = data if isinstance(data, list) else data.get("items", data.get("stories", []))
            offenders = [
                s for s in items
                if re.match(r"^test_", (s.get("title") or s.get("caption") or ""), re.I)
                or re.match(r"^test_", ((s.get("seller") or {}).get("display_handle") or ""), re.I)
            ]
            assert offenders == []


class TestVerifiedGate:
    def test_summary_requires_approved(self, buyer_session):
        r = buyer_session.get(f"{BASE_URL}/api/marketplace/summary", timeout=20)
        assert r.status_code == 200

    def test_summary_unauth_blocked(self):
        r = requests.get(f"{BASE_URL}/api/marketplace/summary", timeout=15)
        assert r.status_code in (401, 403)


class TestCoreEndpointsHealth:
    @pytest.mark.parametrize("path", [
        "/api/members",
        "/api/threads",
        "/api/transactions/mine",
        "/api/notifications",
        "/api/profile/me",
    ])
    def test_endpoint_ok(self, buyer_session, path):
        r = buyer_session.get(f"{BASE_URL}{path}", timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
