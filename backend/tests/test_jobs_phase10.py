"""Phase 10 - Department Job Board tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

ADMIN = {"email": "theaidept@gmail.com", "password": "FirstUnit#Owner2026!"}
MEMBER = {"email": "buyer2@example.com", "password": "BuyerPass#2026"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def member_session():
    return _login(MEMBER)


class TestJobBoardMember:
    def test_get_jobs_unauth_403(self):
        r = requests.get(f"{API}/jobs", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_get_jobs_verified_member(self, member_session):
        r = member_session.get(f"{API}/jobs", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "jobs" in data
        jobs = data["jobs"]
        assert isinstance(jobs, list)
        assert len(jobs) >= 5, f"expected >=5 seeded jobs, got {len(jobs)}"
        j0 = jobs[0]
        for k in ("id", "department", "title", "location", "posted_at"):
            assert k in j0

    def test_get_jobs_sorted_desc(self, member_session):
        r = member_session.get(f"{API}/jobs", timeout=15)
        jobs = r.json()["jobs"]
        dates = [j.get("posted_at") for j in jobs if j.get("posted_at")]
        assert dates == sorted(dates, reverse=True)

    def test_member_cannot_admin_create(self, member_session):
        r = member_session.post(f"{API}/admin/jobs", json={
            "department": "TEST_dept", "title": "TEST_title", "location": "TEST_loc"
        }, timeout=15)
        assert r.status_code == 403


class TestJobBoardAdminCRUD:
    def test_admin_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/jobs", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json()["jobs"], list)

    def test_admin_crud_flow(self, admin_session, member_session):
        # CREATE
        payload = {"department": "TEST_Dept", "title": "TEST_Job Title", "location": "TEST_City, TX"}
        r = admin_session.post(f"{API}/admin/jobs", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        job_id = created["id"]
        assert created["department"] == payload["department"]
        assert created["title"] == payload["title"]
        assert created["location"] == payload["location"]

        # Visible to verified member
        r = member_session.get(f"{API}/jobs", timeout=15)
        assert any(j["id"] == job_id for j in r.json()["jobs"])

        # UPDATE
        upd = {"department": "TEST_Dept2", "title": "TEST_Job Title2", "location": "TEST_City2, TX", "active": True}
        r = admin_session.put(f"{API}/admin/jobs/{job_id}", json=upd, timeout=15)
        assert r.status_code == 200
        updated = r.json()
        assert updated["title"] == upd["title"]

        # Verify persistence
        r = admin_session.get(f"{API}/admin/jobs", timeout=15)
        j = next((x for x in r.json()["jobs"] if x["id"] == job_id), None)
        assert j is not None and j["title"] == upd["title"]

        # DELETE
        r = admin_session.delete(f"{API}/admin/jobs/{job_id}", timeout=15)
        assert r.status_code == 200

        r = admin_session.get(f"{API}/admin/jobs", timeout=15)
        assert not any(x["id"] == job_id for x in r.json()["jobs"])

    def test_audit_log_entries(self, admin_session):
        # Create + delete a job to guarantee audit entries exist
        r = admin_session.post(f"{API}/admin/jobs", json={
            "department": "TEST_AuditDept", "title": "TEST_AuditJob", "location": "TEST_Loc"
        }, timeout=15)
        assert r.status_code == 200
        jid = r.json()["id"]
        admin_session.put(f"{API}/admin/jobs/{jid}", json={
            "department": "TEST_AuditDept", "title": "TEST_AuditJob2", "location": "TEST_Loc", "active": True
        }, timeout=15)
        admin_session.delete(f"{API}/admin/jobs/{jid}", timeout=15)

        r = admin_session.get(f"{API}/admin/audit-log", timeout=15)
        assert r.status_code == 200
        body = r.json()
        entries = body.get("actions") or body.get("entries") or []
        actions = {e.get("action") for e in entries if isinstance(e, dict)}
        for a in ("job_create", "job_update", "job_delete"):
            assert a in actions, f"missing audit action {a}; got {actions}"

    def test_admin_delete_nonexistent(self, admin_session):
        r = admin_session.delete(f"{API}/admin/jobs/does-not-exist-id", timeout=15)
        assert r.status_code == 404
