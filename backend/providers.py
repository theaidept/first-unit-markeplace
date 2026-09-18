"""Verification provider abstraction (constraint 5).

A single interface, VerificationProvider, sits in front of every identity
verification provider. ID.me is primary; SheerID is a swappable stub. The rest
of the app never imports a concrete provider — it calls get_provider().

Data boundary (constraint 2): providers return ONLY a ProviderResult
(outcome + opaque provider_reference + optional subgroup). Raw credential
documents live only on the provider's hosted pages; raw token/userinfo payloads
are reduced immediately here and never returned or persisted.

Mock mode: when a provider's OAuth credentials are not configured, the provider
runs a deterministic mock so the whole flow is testable before real keys land.
Mock rules based on the member-entered credential number:
  - starts with "FAIL"   -> fail   (declined)
  - starts with "REVIEW" -> review (human review queue)
  - anything else        -> pass   (auto-approve)
"""

import os
import uuid
import base64
import hashlib
import secrets
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx


@dataclass
class ProviderResult:
    outcome: str  # "pass" | "review" | "fail"
    provider: str
    provider_reference: str
    subgroup: Optional[str] = None


def pkce_pair():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def _mock_from_prescreen(prescreen: dict, provider_name: str) -> ProviderResult:
    cred = (prescreen.get("credential_number") or "").strip().upper()
    ref = f"{provider_name}_" + uuid.uuid4().hex[:20]
    if cred.startswith("FAIL"):
        return ProviderResult("fail", provider_name, ref)
    if cred.startswith("REVIEW") or not cred:
        return ProviderResult("review", provider_name, ref)
    return ProviderResult("pass", provider_name, ref, subgroup=prescreen.get("responder_type"))


class VerificationProvider(ABC):
    name = "base"

    @abstractmethod
    def is_oauth_configured(self) -> bool: ...

    @abstractmethod
    def authorize_url(self, state: str, challenge: str) -> str: ...

    @abstractmethod
    async def evaluate_callback(self, code: str, verifier: str) -> ProviderResult: ...

    @abstractmethod
    def evaluate_mock(self, prescreen: dict) -> ProviderResult: ...


class IdmeProvider(VerificationProvider):
    name = "idme"

    def __init__(self):
        self.client_id = os.environ.get("IDME_CLIENT_ID", "")
        self.client_secret = os.environ.get("IDME_CLIENT_SECRET", "")
        self.redirect_uri = os.environ.get("IDME_REDIRECT_URI", "")
        self.scope = os.environ.get("IDME_SCOPE", "openid responder")
        self.authorize_base = os.environ.get("IDME_AUTHORIZE_URL", "https://api.idmelabs.com/oauth/authorize")
        self.token_url = os.environ.get("IDME_TOKEN_URL", "https://api.idmelabs.com/oauth/token")
        self.userinfo_url = os.environ.get("IDME_USERINFO_URL", "https://api.idmelabs.com/api/public/v3/userinfo")

    def is_oauth_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)

    def authorize_url(self, state: str, challenge: str) -> str:
        q = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.scope,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        return self.authorize_base + "?" + urlencode(q)

    async def evaluate_callback(self, code: str, verifier: str) -> ProviderResult:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "code_verifier": verifier,
        }
        async with httpx.AsyncClient(timeout=15) as c:
            tok = await c.post(self.token_url, data=data)
            tok.raise_for_status()
            access_token = tok.json().get("access_token")  # never logged / persisted
            info = await c.get(self.userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
            info.raise_for_status()
            attrs = info.json()  # immediately reduced below
        # Reduce to allow-listed fields only.
        group = attrs.get("group")
        subgroup = attrs.get("subgroup")
        ref = attrs.get("uuid") or attrs.get("sub") or ("idme_" + uuid.uuid4().hex[:20])
        if group == "responder":
            return ProviderResult("pass", self.name, ref, subgroup=subgroup)
        if not group:
            return ProviderResult("review", self.name, ref)
        return ProviderResult("fail", self.name, ref)

    def evaluate_mock(self, prescreen: dict) -> ProviderResult:
        return _mock_from_prescreen(prescreen, self.name)


class SheerIDProvider(VerificationProvider):
    """Swappable alternate provider (stub). Same interface, no app changes needed."""

    name = "sheerid"

    def __init__(self):
        self.program_id = os.environ.get("SHEERID_PROGRAM_ID", "")
        self.api_token = os.environ.get("SHEERID_API_TOKEN", "")

    def is_oauth_configured(self) -> bool:
        # SheerID uses a hosted verification program; treat configured creds as OAuth-like redirect.
        return bool(self.program_id and self.api_token)

    def authorize_url(self, state: str, challenge: str) -> str:
        # Stub: SheerID hosts a JS program; a real impl would return the program URL with a tracking id.
        raise NotImplementedError("SheerID hosted program not implemented in this phase")

    async def evaluate_callback(self, code: str, verifier: str) -> ProviderResult:
        raise NotImplementedError("SheerID callback not implemented in this phase")

    def evaluate_mock(self, prescreen: dict) -> ProviderResult:
        return _mock_from_prescreen(prescreen, self.name)


def get_provider() -> VerificationProvider:
    name = os.environ.get("VERIFICATION_PROVIDER", "idme").lower()
    if name == "sheerid":
        return SheerIDProvider()
    return IdmeProvider()
