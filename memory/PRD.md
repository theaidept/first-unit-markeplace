# First Unit — Product Requirements Document

## Original Problem Statement
First Unit is a mobile-first, **verified-only marketplace WEBSITE** (standard responsive web app, NOT Expo/React Native/native) used exclusively by verified first responders (law enforcement, firefighters, EMTs/paramedics, dispatchers — active or retired) to buy and sell with each other. Live production app facilitating real identity verification and real money movement.

## Architecture
- **Stack:** React (CRA/craco) + FastAPI + MongoDB. Responsive website, max content width ~1240px.
- **Auth:** JWT custom auth in httpOnly cookies (access 60m, refresh 7d), bcrypt hashing, brute-force lockout.
- **Design system:** Oswald (headings, uppercase) + Inter (body); navy #0b1f42 / red #a6192e / steel / gold; 2px radius; Verified badge + avatar-ring primitives.

## Non-Negotiable Constraints (permanent)
1. Verified-only access — server-side authorization gate (`require_verified`), not hidden UI.
2. No raw credential/ID document storage anywhere. VerificationRecord holds only current_state/provider/provider_reference/outcome/timestamps.
3. Separated identity layers — `self_user` vs `public_profile` serializers; undercover controls in Profile.
4. Category restriction (firearms/knives blocked) — enforced from first listing (Phase 3+).
5. Provider abstraction for identity verification (ID.me primary, SheerID alt) — Phase 2.
6. Two money lanes: Lane A member↔member OFF-platform (PayPal/Venmo); Lane B platform services ON-platform via Stripe.

## User Personas
- **Member** (first responder): registers, verifies, buys/sells. Starts `unverified`.
- **Admin / Trust & Safety**: approves members, moderation, config.

## Implemented (2026-09-18) — Phase 1 Foundation
- Design system applied globally; reusable VerifiedBadge & AvatarRing components.
- Landing page (wireframe screen 01): hero, USPs, featured stories, how-verification-works, categories, community band, CTA, footer.
- Auth: register (email + password + phone), login, logout, /me, refresh, forgot-password (real Resend email), reset-password.
- Entities: User, Profile (public layer), VerificationRecord (no raw docs), VerificationEvent (append-only log). verification_status enum: unverified|pre_screen|validating|human_review|approved|rejected|suspended.
- Roles: member|admin with admin route guard.
- **Verified-only gate** (`require_verified`) — permanent infra; 401 unauth / 403 unverified / 200 approved.
- Verification-pending screen (own status + event log) for unverified; empty marketplace shell for approved.
- Temporary admin control to set verification_status (admin-only), with AdminAction audit + VerificationEvent logging.
- Seeded admins: theaidept@gmail.com (owner), admin@firstunit.us. Both approved.
- Tested: 21/21 backend pass, frontend E2E 100%.

## Implemented (2026-09-18) — Phase 2 Verification System
- **Provider abstraction** (`providers.py`): `VerificationProvider` ABC; `IdmeProvider` (OAuth authorize + PKCE + callback→userinfo reduction) primary; `SheerIDProvider` stub; `get_provider()` selected via `VERIFICATION_PROVIDER` env. Runs in MOCK mode until real ID.me keys are set (swap needs no code changes outside providers.py).
- **4-step flow**: pre-screening form (responder type/status/agency/credential#/rank/years; credential photo is NEVER uploaded to our server) → credential validation → human review → activation. Drives verification_status through the enum.
- **Mock rules** (testable now): credential# `FAIL*`→rejected, `REVIEW*`→human_review, else→auto-approved. Real mode returns an ID.me authorize URL; `/verification/callback` (frontend) → `GET /api/verification/idme/callback` exchanges code + evaluates.
- **Member approval log**: append-only VerificationEvent, shown in `/verification` (Date/Event/Reviewer/Status; reviewers System | ID.me Gateway | Trust & Safety Team | admin email).
- **Admin review queue** (`/admin`): pending human-review cases show member-entered fields + provider outcome (no raw docs); approve/reject with reason writes events + fires alerts. Phase 1 manual override retained as fallback.
- **Status alerts**: email via Resend (live) + SMS via Twilio (mock/log until creds provided) at each transition; failures never block transitions.
- **Data boundary verified**: verification_records hold only id/user_id/current_state/provider/provider_reference/outcome/timestamps + member-entered prescreen. No raw documents, no token/userinfo payloads.
- Tested: 15/15 Phase 2 backend + frontend 100%, zero issues.
- **PENDING USER INPUT:** real ID.me sandbox client_id/secret and Twilio SID/token/from-number — paste to flip both integrations from MOCK to live (no code changes needed).

## Implemented (2026-09-18) — Phase 3 Member Profiles + Undercover Privacy
- **Separated identity (constraint 3):** `public_profile(profile,user)` serializer returns ONLY public-layer fields; verified-identity (real name, credential #, provider reference, prescreen) is never in any member-facing response. Audited CLEAN by tests.
- **Public profile fields:** display_handle, optional avatar, agency, rank, years_of_service, verified_badge, photo_visibility (photo|avatar|initials), undercover, + derived initials; responder_type/service_status shown as category labels.
- **Undercover model:** member-owned controls — avatar-ring / initials / photo, undercover toggle hides photo (and real name never public); a fully verified undercover member appears anonymous while STILL showing the Verified badge. Privacy-safe default = avatar-ring.
- **Endpoints (all behind require_verified):** GET/PUT /profile/me, GET /members, GET /profiles/{user_id}.
- **Frontend:** MyProfile (live-preview + edit form with visibility options & undercover toggle), Members directory grid, MemberProfile view; AppNav links (Marketplace/Members/Profile); ProfileCard + AvatarRing initials support.
- Tested: 100% backend + 100% frontend (iteration_5), zero issues.

## Implemented (2026-09-18) — Phase 4 Marketplace Core
- **Categories:** Gear & Equipment / Vehicles / Art & Personal Items (active). Firearms & Edged Weapons exist but `is_restricted=true, active=false` (blocked); restrictable categories behind policy gate.
- **Restriction enforcement (constraint 4) from day one:** restricted category => 400; firearm/knife blocked-keyword scan on publish => listing status `flagged`, kept out of feed, Report row created.
- **Listings:** POST/PUT with draft|live|flagged|removed|sold; Save-as-draft; fields title/category/condition/location/description/price/photos[]/meetup_note. Feed GET /listings (q + category + featured), GET /listings/{id}, GET /listings/mine.
- **Photos:** Emergent object storage (EMERGENT_LLM_KEY); POST /upload => /api/files/{path}; GET /files/{path} cookie-authed image serving.
- **Offers:** make offer / buy-now (intent at asking price, NO payment) / accept / decline / withdraw with correct state transitions; seller can't offer on own listing.
- **Frontend:** Sell wizard (Step 1 Details & Media photos-only, Step 3 Review; Step 2 Pricing shown-disabled), feed/dashboard (search + all chips + Featured Stories placeholder + inert Has-video chip), product detail (gallery, seller card + inert Message, Buy Now/Make Offer, description, Meet-up Guidance), offers management.
- All routes behind require_verified; sellers shown via public profile layer only.
- Tested: 100% backend + 100% frontend (iteration_6), zero issues.

## Implemented (2026-09-18) — Phase 5 Lane A Off-Platform Payments
- **No fund custody (constraint 6):** First Unit never holds funds — no wallet/escrow/balance anywhere (verified). Members link their OWN PayPal (PayPal.me handle capture, honest fallback until Connect keys are pasted; OAuth `start` wired) + optional PayPal email + Venmo handle; all editable in /profile.
- **Transaction handoff:** Buy Now OR seller accepting an offer creates a Transaction (listing, buyer, seller, agreed_amount, status agreed). Buyer sees the seller's correct PayPal.me/Venmo pay path (URL-encoded) + meet-up guidance; seller view never exposes pay targets. Guard prevents duplicate open transactions per listing.
- **States agreed|completed|cancelled:** either party marks complete; both complete => listing `sold`. Either party can cancel while agreed.
- **Admin ListingFeeConfig:** amount default 0, active default false; admin GET/PUT; NOT charged, NOT wired to Stripe (Lane B placeholder).
- **Frontend:** PaymentSettings on /profile, /transactions (Deals) with pay buttons + complete/cancel, Buy Now/accept navigation, admin fee panel, nav-deals link.
- Tested: 100% backend + 100% frontend (iteration_7), zero issues.
- **PENDING USER INPUT:** real PayPal Connect Client ID/Secret (sandbox) to flip PayPal from handle-capture fallback to OAuth (no code changes beyond env + restart).

## Backlog (prioritized)
- **P0 — Phase 2:** Real ID.me verification behind provider abstraction; SMS status alerts (Twilio) using stored phone; full public Profile UI + undercover controls.
- **P1 — Phase 3:** Category system (firearms/knives blocked + blocked-keyword filter), Listing CRUD, photos/video upload (object storage), Offers, Transaction (Lane A PayPal/Venmo handoff).
- **P1 — Phase 4:** Messaging (MessageThread/Message), Reports/moderation queue, AdminAction expansion.
- **P2 — Phase 5:** Stories (shoppable overlay), BoostType/BoostPurchase via Stripe (Lane B), ListingFeeConfig, JobPosting board.

## Next Tasks
- Await Phase 2 prompt (ID.me integration + provider abstraction).
