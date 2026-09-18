"""Phase 6 — video-on-listings + shoppable Stories."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://first-responders-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SELLER = ("pass.officer@pd.gov", "Passw0rd!")
BUYER = ("review.emt@ems.gov", "Passw0rd!")
ADMIN = ("admin@firstunit.us", "FirstUnit#Admin2026!")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def seller():
    return _login(*SELLER)


@pytest.fixture(scope="module")
def buyer():
    return _login(*BUYER)


@pytest.fixture(scope="module")
def admin():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def anon():
    return requests.Session()


# ---------- Verified-only gate ----------
class TestGate:
    def test_upload_video_unauth_401(self, anon):
        r = anon.post(f"{API}/upload/video", files={"file": ("a.mp4", b"x", "video/mp4")})
        assert r.status_code == 401

    def test_stories_unauth_401(self, anon):
        r = anon.get(f"{API}/stories")
        assert r.status_code == 401

    def test_files_unauth_401(self, anon):
        r = anon.get(f"{API}/files/first-unit/videos/does/not/exist.mp4")
        assert r.status_code == 401

    def test_unverified_forbidden(self, anon):
        # Register fresh unverified account
        email = f"TEST_ph6_unverified_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "5551230000"})
        assert r.status_code == 200
        r1 = s.post(f"{API}/upload/video", files={"file": ("a.mp4", b"x", "video/mp4")})
        assert r1.status_code == 403
        r2 = s.get(f"{API}/stories")
        assert r2.status_code == 403
        r3 = s.get(f"{API}/files/first-unit/videos/x.mp4")
        assert r3.status_code == 403


# ---------- Upload validation ----------
class TestUploadVideoValidation:
    def test_reject_non_video_extension(self, seller):
        r = seller.post(f"{API}/upload/video", files={"file": ("evil.exe", b"x" * 100, "application/octet-stream")})
        assert r.status_code == 400
        assert "video" in r.json().get("detail", "").lower()

    def test_reject_over_120mb(self, seller):
        # Create a >120MB payload
        big = b"0" * (120 * 1024 * 1024 + 10)
        r = seller.post(f"{API}/upload/video", files={"file": ("big.mp4", big, "video/mp4")})
        assert r.status_code == 400
        assert "120" in r.json().get("detail", "") or "under" in r.json().get("detail", "").lower()

    def test_accept_small_mp4(self, seller):
        data = b"\x00\x00\x00\x20ftypisom" + b"0" * 512
        r = seller.post(f"{API}/upload/video", files={"file": ("small.mp4", data, "video/mp4")})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "path" in body and "url" in body
        assert body["url"].startswith("/api/files/")
        # File must be fetchable via GET /files
        rf = seller.get(f"{BASE_URL}{body['url']}")
        assert rf.status_code == 200
        assert rf.headers.get("Content-Type", "").startswith("video/")
        # Save path on the class so next test can use it
        TestUploadVideoValidation.video_path = body["path"]


# ---------- Listings + has_video + stories lifecycle ----------
class TestListingWithVideoAndStory:
    listing_id = None
    video_path = None

    def test_create_live_listing_with_video(self, seller):
        # Upload a small mp4
        data = b"\x00\x00\x00\x20ftypisom" + b"0" * 256
        u = seller.post(f"{API}/upload/video", files={"file": ("v.mp4", data, "video/mp4")})
        assert u.status_code == 200
        TestListingWithVideoAndStory.video_path = u.json()["path"]

        # Also upload a photo
        img = b"\x89PNG\r\n\x1a\n" + b"0" * 128
        p = seller.post(f"{API}/upload", files={"file": ("p.png", img, "image/png")})
        assert p.status_code == 200
        photo_path = p.json()["path"]

        payload = {
            "title": f"TEST_ph6 Video Item {uuid.uuid4().hex[:6]}",
            "category": "gear",
            "condition": "Good",
            "location": "Austin, TX",
            "description": "Test with video",
            "price": 42.5,
            "photos": [photo_path],
            "video": TestListingWithVideoAndStory.video_path,
            "publish": True,
        }
        r = seller.post(f"{API}/listings", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "live"
        assert body["video"] == TestListingWithVideoAndStory.video_path
        assert body["has_video"] is True
        TestListingWithVideoAndStory.listing_id = body["id"]

    def test_feed_has_video_true_includes_it(self, seller):
        r = seller.get(f"{API}/listings", params={"has_video": "true"})
        assert r.status_code == 200
        ids = [l["id"] for l in r.json()["listings"]]
        assert TestListingWithVideoAndStory.listing_id in ids
        # every listing returned must have video / has_video
        for l in r.json()["listings"]:
            assert l["has_video"] is True
            assert l["video"]

    def test_feed_no_filter_includes_it(self, seller):
        r = seller.get(f"{API}/listings")
        assert r.status_code == 200
        ids = [l["id"] for l in r.json()["listings"]]
        assert TestListingWithVideoAndStory.listing_id in ids

    def test_listing_detail_exposes_video(self, seller):
        r = seller.get(f"{API}/listings/{TestListingWithVideoAndStory.listing_id}")
        assert r.status_code == 200
        b = r.json()
        assert b["has_video"] is True
        assert b["video"] == TestListingWithVideoAndStory.video_path

    def test_story_auto_generated(self, buyer):
        r = buyer.get(f"{API}/stories")
        assert r.status_code == 200
        stories = r.json()["stories"]
        # Find story for our listing
        match = [s for s in stories if s["listing_id"] == TestListingWithVideoAndStory.listing_id]
        assert len(match) == 1
        s = match[0]
        # Must resolve to its listing
        assert s["listing_id"]
        assert s["video"]
        assert "title" in s and "price" in s
        # Seller is public layer only — no email/real-name leak
        seller_pub = s["seller"]
        assert "display_handle" in seller_pub
        assert "email" not in seller_pub
        assert "phone" not in seller_pub
        assert "verified_badge" in seller_pub
        # No credential/real name fields
        for k in ("credential_number", "real_name", "full_name"):
            assert k not in seller_pub

    def test_all_stories_resolve_to_live_listings(self, buyer):
        r = buyer.get(f"{API}/stories")
        assert r.status_code == 200
        for s in r.json()["stories"]:
            assert s.get("listing_id"), "Every story must have a non-null listing_id"
            # each listing_id resolves to a live listing with a video
            lr = buyer.get(f"{API}/listings/{s['listing_id']}")
            assert lr.status_code == 200, f"story listing {s['listing_id']} not resolvable"
            lb = lr.json()
            assert lb["status"] == "live"
            assert lb["has_video"] is True
            assert lb["video"]

    def test_story_deactivated_when_listing_leaves_live(self, seller):
        # Update listing to remove video (still publish=false so status stays live? actually publish flag drives status)
        # Instead, update listing without publish=True so status remains "live" but we set publish=True with no video
        # to trigger sync_story deactivation while keeping listing live-but-no-video.
        payload = {
            "title": "TEST_ph6 Video Item removed",
            "category": "gear",
            "condition": "Good",
            "location": "Austin, TX",
            "description": "video removed",
            "price": 42.5,
            "photos": ["dummy"],  # non-empty
            "video": None,
            "publish": True,
        }
        # Need a real photo for publish. Reuse the one we uploaded earlier via mine
        mine = seller.get(f"{API}/listings/mine").json()["listings"]
        cur = [l for l in mine if l["id"] == TestListingWithVideoAndStory.listing_id][0]
        payload["photos"] = cur["photos"]
        r = seller.put(f"{API}/listings/{TestListingWithVideoAndStory.listing_id}", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["has_video"] is False
        # Story should no longer appear in GET /stories
        s = seller.get(f"{API}/stories").json()["stories"]
        ids = [x["listing_id"] for x in s]
        assert TestListingWithVideoAndStory.listing_id not in ids

    def test_re_add_video_reactivates_story(self, seller):
        # Put the video back
        mine = seller.get(f"{API}/listings/mine").json()["listings"]
        cur = [l for l in mine if l["id"] == TestListingWithVideoAndStory.listing_id][0]
        payload = {
            "title": cur["title"], "category": cur["category"], "condition": cur["condition"],
            "location": cur.get("location") or "", "description": cur.get("description") or "",
            "price": cur["price"], "photos": cur["photos"],
            "video": TestListingWithVideoAndStory.video_path,
            "publish": True,
        }
        r = seller.put(f"{API}/listings/{TestListingWithVideoAndStory.listing_id}", json=payload)
        assert r.status_code == 200
        s = seller.get(f"{API}/stories").json()["stories"]
        assert TestListingWithVideoAndStory.listing_id in [x["listing_id"] for x in s]


# ---------- No-video listing => no story ----------
class TestNoVideoNoStory:
    def test_photo_only_listing_creates_no_story(self, seller, buyer):
        img = b"\x89PNG\r\n\x1a\n" + b"0" * 128
        p = seller.post(f"{API}/upload", files={"file": ("p.png", img, "image/png")})
        assert p.status_code == 200
        photo_path = p.json()["path"]
        payload = {
            "title": f"TEST_ph6 NoVideo {uuid.uuid4().hex[:6]}",
            "category": "gear", "condition": "Good", "location": "",
            "description": "no video", "price": 10.0,
            "photos": [photo_path], "video": None, "publish": True,
        }
        r = seller.post(f"{API}/listings", json=payload)
        assert r.status_code == 200
        lid = r.json()["id"]
        assert r.json()["has_video"] is False
        # Confirm no story
        stories = buyer.get(f"{API}/stories").json()["stories"]
        assert lid not in [s["listing_id"] for s in stories]
        # Confirm feed has_video=true does NOT include it
        feed = buyer.get(f"{API}/listings", params={"has_video": "true"}).json()["listings"]
        assert lid not in [l["id"] for l in feed]


# ---------- No live streaming ----------
class TestNoLiveStreaming:
    def test_openapi_has_no_live_streaming(self):
        r = requests.get(f"{API}/openapi.json", timeout=30)
        # openapi may be at /openapi.json (not under /api). try both
        if r.status_code != 200:
            r = requests.get(f"{BASE_URL}/openapi.json", timeout=30)
        assert r.status_code == 200
        body = r.text.lower()
        for banned in ("rtmp", "livestream", "live_stream", "hls", "/stream/start", "websocket", "/ws/"):
            assert banned not in body, f"OpenAPI mentions '{banned}' — live streaming surface should not exist"
