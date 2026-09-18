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

## Backlog (prioritized)
- **P0 — Phase 2:** Real ID.me verification behind provider abstraction; SMS status alerts (Twilio) using stored phone; full public Profile UI + undercover controls.
- **P1 — Phase 3:** Category system (firearms/knives blocked + blocked-keyword filter), Listing CRUD, photos/video upload (object storage), Offers, Transaction (Lane A PayPal/Venmo handoff).
- **P1 — Phase 4:** Messaging (MessageThread/Message), Reports/moderation queue, AdminAction expansion.
- **P2 — Phase 5:** Stories (shoppable overlay), BoostType/BoostPurchase via Stripe (Lane B), ListingFeeConfig, JobPosting board.

## Next Tasks
- Await Phase 2 prompt (ID.me integration + provider abstraction).
