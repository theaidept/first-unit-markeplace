"""Phase 5 — off-platform payments + transactions + admin listing-fee.

Covers:
- /api/payments/me (GET/PUT), /api/payments/paypal/start (fallback)
- Buy Now + offer accept -> creates Transaction (agreed)
- pay_targets built only for buyer view; seller view omits them
- Complete (both sides) => listing sold ; one-sided => waiting_on_other_party
- Cancel
- Admin listing-fee GET/PUT + 403 for member
- Verified-only gate on all Phase-5 endpoints (401 unauth, 403 unverified)
- No wallet/escrow/balance surface anywhere in API
"""
import os
import uuid
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"

ADMIN = ("admin@firstunit.us", "FirstUnit#Admin2026!")
SELLER = ("pass.officer@pd.gov", "Passw0rd!")
BUYER = ("review.emt@ems.gov", "Passw0rd!")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_s():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def seller_s():
    return _login(*SELLER)


@pytest.fixture(scope="module")
def buyer_s():
    return _login(*BUYER)


@pytest.fixture(scope="module")
def fresh_listing(seller_s):
    # create + publish a live listing to test cleanly
    # need at least one photo -> upload a tiny png
    png = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
    )
    up = seller_s.post(
        f"{BASE}/upload",
        files={"file": ("t.png", png, "image/png")},
        timeout=60,
    )
    assert up.status_code == 200, up.text
    photo_url = up.json()["url"]

    body = {
        "title": f"TEST_ph5 helmet {uuid.uuid4().hex[:6]}",
        "category": "gear",
        "condition": "Good",
        "location": "Denver, CO",
        "description": "spare helmet",
        "price": 120.0,
        "photos": [photo_url],
        "meetup_note": "Station 14 parking lot, weekday evenings",
        "publish": True,
    }
    r = seller_s.post(f"{BASE}/listings", json=body, timeout=30)
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    assert r.json()["status"] == "live"
    return lid


# ------------------------------------------------------------------ Payments
class TestPayments:
    def test_seller_has_paypal_and_venmo_linked(self, seller_s):
        r = seller_s.get(f"{BASE}/payments/me")
        assert r.status_code == 200
        d = r.json()
        assert d["paypal_connected"] is True
        assert d["oauth_available"] is False
        assert d["paypal_me"]  # linked
        assert d["venmo_handle"]

    def test_put_paypal_strips_leading_at(self, buyer_s):
        r = buyer_s.put(
            f"{BASE}/payments/me",
            json={"paypal_me": "@review-emt", "venmo_handle": "@review-emt", "paypal_email": "reemt@example.com"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paypal_me"] == "review-emt"
        assert d["venmo_handle"] == "review-emt"
        assert d["paypal_email"] == "reemt@example.com"
        assert d["paypal_connected"] is True
        # editable — change again
        r2 = buyer_s.put(f"{BASE}/payments/me", json={"paypal_me": "review-emt2"})
        assert r2.json()["paypal_me"] == "review-emt2"
        # persistence
        g = buyer_s.get(f"{BASE}/payments/me").json()
        assert g["paypal_me"] == "review-emt2"

    def test_paypal_start_fallback(self, seller_s):
        r = seller_s.post(f"{BASE}/payments/paypal/start")
        assert r.status_code == 200
        assert r.json()["mode"] == "manual"


# ------------------------------------------------------------------ Buy Now
class TestBuyNowTransaction:
    def test_buy_now_creates_agreed_transaction(self, buyer_s, seller_s, fresh_listing):
        r = buyer_s.post(f"{BASE}/listings/{fresh_listing}/buy-now")
        assert r.status_code == 200, r.text
        tx_id = r.json()["transaction_id"]
        assert tx_id

        # BUYER view — has pay_targets
        mine = buyer_s.get(f"{BASE}/transactions/mine").json()["transactions"]
        tx = next(t for t in mine if t["id"] == tx_id)
        assert tx["status"] == "agreed"
        assert tx["role"] == "buyer"
        assert "pay_targets" in tx
        methods = {p["method"] for p in tx["pay_targets"]}
        assert "paypal" in methods and "venmo" in methods
        pp = next(p for p in tx["pay_targets"] if p["method"] == "paypal")
        assert pp["url"].startswith("https://www.paypal.com/paypalme/")
        assert "/120.00" in pp["url"]
        vm = next(p for p in tx["pay_targets"] if p["method"] == "venmo")
        assert vm["url"].startswith("https://venmo.com/")
        assert "txn=pay" in vm["url"] and "amount=120.00" in vm["url"]
        # counterparty is seller public handle only
        assert "display_handle" in tx["counterparty"]
        assert "email" not in tx["counterparty"]

        # SELLER view — NO pay_targets
        s_mine = seller_s.get(f"{BASE}/transactions/mine").json()["transactions"]
        stx = next(t for t in s_mine if t["id"] == tx_id)
        assert stx["role"] == "seller"
        assert "pay_targets" not in stx
        assert "display_handle" in stx["counterparty"]
        assert "email" not in stx["counterparty"]

        # cleanup: cancel so it doesn't interfere
        buyer_s.post(f"{BASE}/transactions/{tx_id}/cancel")


# ------------------------------------------------------------------ Offer -> Accept -> Transaction, Complete flow
class TestOfferAcceptCompleteFlow:
    def test_full_flow(self, buyer_s, seller_s):
        # Create separate listing to allow complete flow without interference
        png = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
            "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
        )
        up = seller_s.post(f"{BASE}/upload", files={"file": ("t.png", png, "image/png")})
        photo = up.json()["url"]
        r = seller_s.post(
            f"{BASE}/listings",
            json={
                "title": f"TEST_ph5 boots {uuid.uuid4().hex[:6]}",
                "category": "gear", "condition": "Good", "location": "X", "description": "boots",
                "price": 200.0, "photos": [photo], "publish": True,
            },
        )
        lid = r.json()["id"]

        # buyer offers $150
        off = buyer_s.post(f"{BASE}/listings/{lid}/offers", json={"amount": 150})
        assert off.status_code == 200
        oid = off.json()["id"]

        # seller accepts -> returns transaction_id
        acc = seller_s.post(f"{BASE}/offers/{oid}/accept")
        assert acc.status_code == 200, acc.text
        tx_id = acc.json().get("transaction_id")
        assert tx_id

        tx = buyer_s.get(f"{BASE}/transactions/{tx_id}").json()
        assert tx["status"] == "agreed"
        assert tx["agreed_amount"] == 150.0
        assert any("150.00" in p["url"] for p in tx["pay_targets"])

        # one-sided complete keeps 'agreed'
        r1 = buyer_s.post(f"{BASE}/transactions/{tx_id}/complete")
        assert r1.status_code == 200
        assert r1.json()["transaction_status"] == "agreed"
        assert r1.json().get("waiting_on_other_party") is True

        # seller completes -> completed + listing sold
        r2 = seller_s.post(f"{BASE}/transactions/{tx_id}/complete")
        assert r2.status_code == 200
        assert r2.json()["transaction_status"] == "completed"

        lst = seller_s.get(f"{BASE}/listings/{lid}").json()
        assert lst["status"] == "sold"

        # cannot complete after completed
        r3 = seller_s.post(f"{BASE}/transactions/{tx_id}/complete")
        assert r3.status_code == 400

    def test_cancel_flow(self, buyer_s, seller_s, fresh_listing):
        r = buyer_s.post(f"{BASE}/listings/{fresh_listing}/buy-now")
        # If listing already handled, create fresh — but fresh_listing not sold, so ok
        if r.status_code != 200:
            pytest.skip("listing not available")
        tx_id = r.json()["transaction_id"]
        c = seller_s.post(f"{BASE}/transactions/{tx_id}/cancel")
        assert c.status_code == 200
        assert c.json()["transaction_status"] == "cancelled"
        # can't complete a cancelled tx
        r2 = buyer_s.post(f"{BASE}/transactions/{tx_id}/complete")
        assert r2.status_code == 400


# ------------------------------------------------------------------ Admin listing fee
class TestAdminListingFee:
    def test_get_default(self, admin_s):
        r = admin_s.get(f"{BASE}/admin/listing-fee")
        assert r.status_code == 200
        d = r.json()
        assert "amount" in d and "active" in d
        # default at launch: 0/inactive (but may have been changed by earlier tests)
        assert isinstance(d["amount"], (int, float))
        assert isinstance(d["active"], bool)

    def test_put_updates(self, admin_s):
        r = admin_s.put(f"{BASE}/admin/listing-fee", json={"amount": 2.5, "active": True})
        assert r.status_code == 200
        assert r.json() == {"amount": 2.5, "active": True}
        # verify persistence via GET
        g = admin_s.get(f"{BASE}/admin/listing-fee").json()
        assert g["amount"] == 2.5 and g["active"] is True
        # reset to defaults
        admin_s.put(f"{BASE}/admin/listing-fee", json={"amount": 0, "active": False})

    def test_member_forbidden_put(self, seller_s):
        r = seller_s.put(f"{BASE}/admin/listing-fee", json={"amount": 5, "active": True})
        assert r.status_code == 403

    def test_member_forbidden_get(self, seller_s):
        r = seller_s.get(f"{BASE}/admin/listing-fee")
        assert r.status_code == 403


# ------------------------------------------------------------------ Verified-only gate
class TestVerifiedGate:
    def test_unauth_401(self):
        s = requests.Session()
        assert s.get(f"{BASE}/payments/me").status_code == 401
        assert s.get(f"{BASE}/transactions/mine").status_code == 401
        assert s.post(f"{BASE}/listings/anything/buy-now").status_code == 401
        assert s.post(f"{BASE}/transactions/xyz/complete").status_code == 401
        assert s.post(f"{BASE}/transactions/xyz/cancel").status_code == 401

    def test_unverified_403(self):
        # register a fresh user (starts unverified)
        s = requests.Session()
        email = f"TEST_ph5_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{BASE}/auth/register", json={"email": email, "password": "Passw0rd!", "phone": "5551234567"})
        assert r.status_code == 200
        assert s.get(f"{BASE}/payments/me").status_code == 403
        assert s.get(f"{BASE}/transactions/mine").status_code == 403
        assert s.post(f"{BASE}/listings/xyz/buy-now").status_code == 403
        assert s.post(f"{BASE}/transactions/xyz/complete").status_code == 403
        assert s.post(f"{BASE}/transactions/xyz/cancel").status_code == 403


# ------------------------------------------------------------------ No fund custody
class TestNoFundCustody:
    def test_openapi_has_no_wallet_or_escrow(self):
        r = requests.get(f"{BASE.replace('/api','')}/openapi.json", timeout=30)
        if r.status_code != 200:
            pytest.skip("openapi not available")
        text = r.text.lower()
        for banned in ["wallet", "escrow", "balance", "stripe", "card_number", "cvv"]:
            assert banned not in text, f"banned surface '{banned}' present in API"

    def test_self_user_never_has_balance(self, buyer_s):
        r = buyer_s.get(f"{BASE}/auth/me").json()
        for banned in ["balance", "wallet", "escrow"]:
            assert banned not in r
