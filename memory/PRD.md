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

## Implemented (2026-09-18) — Phase 6 Video + Shoppable Stories
- **Video on listings:** POST /upload/video (object storage, MP4/MOV/WEBM/M4V, <120MB) added in the Sell wizard alongside photos; listing carries `video`, `has_video` derived; served via GET /files/{path}. "Has video" feed chip now active (has_video filter).
- **Featured Stories reel** on dashboard: horizontal reel of avatar-ring story cards (price caption) opening a vertical Story viewer that plays the product video.
- **Shoppable overlay (required):** every story viewer has a "View & Buy" overlay → /listing/{listing_id}; GET /stories only returns active stories resolving to a live listing with video; seller shown via public layer only.
- **Story entity** {listing, video, order, active} auto-synced on publish (created when live+video, deactivated otherwise). Pre-recorded only — no live streaming.
- Tested: 100% backend + 100% frontend (iteration_8), zero issues.

## Implemented (2026-09-18) — Phase 7 Lane B Monetization (Stripe boosts)
- **Stripe = platform merchant, test mode (constraint 6):** claimable sandbox provisioned (Flow A); keys in backend/.env (STRIPE_SECRET_KEY/PUBLISHABLE/ACCOUNT_ID/WEBHOOK_SECRET/MODE). Stripe is used ONLY for platform services (boosts now, listing fee later) — NEVER for member↔member item money (that stays Lane A / off-platform).
- **Admin boost management** (`/admin` boost-admin-panel): BoostType {name, price, duration_days | until_sold, hidden, active, order}. Admin can create / edit / hide-show / deactivate-reactivate / delete tiers, and a global `boost_feature` toggle hides the feature entirely. All pricing admin-controlled — no hard-coded prices. Seeded defaults: 3-Day $9, 7-Day $19, Until Sold $29.
- **Sell wizard Pricing step** (screen 05): shows non-hidden active tiers + a listing summary (asking price, marketplace fee = configured listing fee $0 at launch, boost line, total to publish). "Publish without featuring" is free; if boosts hidden entirely the step still publishes free. Publish creates the live listing first, then redirects to Stripe hosted checkout for the boost (`origin_url` → /payment/success|/payment/cancel).
- **Boost checkout + fulfillment:** POST /listings/{id}/boost/checkout (owner-only, live-listing-only) → inline dynamic price_data session (server-side amount = boost price + active fee). Unauthenticated GET /payments/status/{session_id} polls Stripe and idempotently fulfills; POST /api/stripe/webhook also fulfills. `_fulfill_payment` branches on kind — `boost` now, `listing_fee` reuses the SAME layer later with no rebuild.
- **BoostPurchase** {listing, boost_type, stripe_ref, starts_at, ends_at}. `_apply_boost` sets listing featured + featured_until (null = Until Sold, until listing sells); stacking never shortens a longer active window. `_featured_active` gates the FEATURED tag/expiry. Feed surfaces featured first; Featured Stories reel gives boosted listings priority.
- Tested: 100% backend (13/13) + 100% frontend (iteration_9), zero blocking issues. Post-test hardening: live-only boost guard + longest-window stacking (both re-verified).

## Backlog (prioritized)
- **P1:** Phase 8 verified-member messaging (MessageThread/Message; Message button currently inert).
- **P1:** Real ID.me sandbox creds + callback validation; real Twilio SMS creds + delivery.
- **P2:** Reports/moderation queue expansion, JobPosting board, activate a real listing fee (bills through the existing Stripe layer).
- **P2:** Refactor — split boosts/payments + listings into routers modules (server.py ~2000 lines).

## Next Tasks
- Await user acceptance of Phase 7; then Phase 8 messaging or real-provider credentials.

## Implemented (2026-09-22) — Phase 8 Verified-only Messaging
- **Buyer↔seller direct messaging** initiated from a listing's "Message seller" button/seller card. `message_threads` (tied to listing + 2 participants, buyer/seller) + `messages` (read_by tracking). Endpoints: POST/GET `/api/threads`, GET `/api/threads/{id}` (marks read + records `last_viewed`), POST `/api/threads/{id}/messages`, GET `/api/messages/unread-count`. All `require_verified`; participant-guarded (404 otherwise).
- **Verified-only enforced** (constraint 1): unverified/unauth = 403 on every messaging route and cannot reach `/messages`. Participants shown via public-handle layer only (constraint 3) — no real name/email leak; avatar nulled server-side when private.
- **Conduct rules** surfaced in the conversation UI + **in-chat Report** (POST `/api/threads/{id}/report`) creating a `reports` record with `target_type='message_thread'`, reported_user, listing_id, and full `thread_snapshot`. Preset reasons (scam_fraud/prohibited_item/harassment/spam/other) + optional note; invalid reason → 400. (Phase 9 will handle moderation.)
- **Notifications**: in-app `notifications` always created for the recipient; email (Resend) + SMS (Twilio) fire only when recipient is NOT actively viewing the thread (30s `last_viewed` window). **SMS is MOCKED** until Twilio creds are supplied. Nav shows a live unread badge (polls `/api/messages/unread-count`); inbox polls 5s, conversation polls 4s.
- Frontend: `Messages.jsx` (inbox), `Thread.jsx` (chat + report modal), listing "Message seller" wired, AppNav Messages link+badge, routes under `RequireApproved`.
- Tested: 100% backend (15/15) + 100% frontend (iteration_11), zero issues. Test member: buyer2@example.com / BuyerPass#2026 (approved).

## Backlog (prioritized)
- **P1:** Phase 9 moderation queue / report-handling admin UI (reports already created for listings + message_threads).
- **P1:** Real ID.me sandbox creds + callback validation; real Twilio SMS creds + delivery (SMS currently mocked).
- **P2:** Jobs board, activate a real listing fee (bills through the existing Stripe layer), refactor server.py (~2200 lines) into router modules.

## Next Tasks
- Await user acceptance of Phase 8; then Phase 9 moderation/report handling.

## Implemented (2026-09-22) — Phase 9 Trust & Safety + consolidated admin console
- **Reporting across the app**: `POST /api/reports` for listings & users + existing in-chat thread report. Report entity: reporter, target_type (listing|user|message_thread), target_id, reason, reason_code, note, status (open|reviewing|actioned|dismissed), reviewer, reported_user/listing_id, thread_snapshot. Self-report and invalid reason → 400. Frontend: reusable `ReportDialog` wired into ListingDetail ("Report this listing") and MemberProfile ("Report this member"); in-chat report retained.
- **Moderation** (admin-only): `GET /api/admin/reports` (enriched, open-first), `POST /api/admin/reports/{id}/status` (reviewing/dismissed/actioned); `GET /api/admin/listings` + `POST /api/admin/listings/{id}/moderate` (remove→status=removed & auto-actions its open reports / reinstate→live); `POST /api/admin/users/{id}/moderate` (warn=notification / suspend=verification_status=suspended, access revoked / reinstate=approved). Cannot moderate an admin (400).
- **Enforcement**: suspended users are blocked instantly by the existing verified-only gate (verified curl: suspended → 403 on member routes).
- **Audit**: every moderation/admin action writes an `admin_actions` entry (admin_email, action, target, detail); `GET /api/admin/audit-log`.
- **Manual override lockdown**: `POST /api/admin/users/{id}/verification-status` now REQUIRES a reason (400 without) and audits as `manual_verification_override`; UI prompts for the reason.
- **Consolidated console** (`/admin`, 4 tabs): Overview = live health counts (`GET /api/admin/health`: verification breakdown, throughput 7d, listings breakdown, listing activity 7d, reports, sign-ups) from real data; Verification = review queue + accounts; Moderation = reports queue + listing moderation + user warn/suspend; Monetization = listing-fee + boost config (Phases 5/7).
- Tested: 100% backend (26/26 serial) + 100% frontend (iteration_12), zero issues. Test member buyer2@example.com / BuyerPass#2026 (approved).

## Backlog (prioritized)
- **P1:** Real ID.me sandbox creds + callback validation; real Twilio SMS creds + delivery (SMS mocked).
- **P2:** Jobs board; activate a real listing fee (bills through existing Stripe layer); moderation enhancements (report detail drawer w/ full thread snapshot, member report history); refactor server.py (~2500 lines) into router modules.

## Next Tasks
- Await user acceptance of Phase 9; then Jobs board or real-provider credentials.

## Implemented (2026-09-22) — Phase 10 Department Job Board + marketing polish
- **Department Job Board** sidebar panel on the marketplace dashboard (`JobBoard.jsx` in a new `feed-layout` = feed-main + sticky aside; stacks on mobile). Shows seeded postings with title, department, location, recency tag. `GET /api/jobs` (verified-only). 5 seeded postings via `seed_jobs()`.
- **Admin job management** (new "Job Board" tab in the consolidated console): create/edit(inline)/remove postings. `GET/POST/PUT/DELETE /api/admin/jobs` — admin-only, each action audited (job_create/job_update/job_delete). No department self-service (as scoped).
- **JobPosting** entity: department, title, location, posted_at, active. Admin console now has 5 tabs: Overview / Verification / Moderation / Monetization / Job Board.
- **Marketing/landing** confirmed complete + mobile-first (no horizontal overflow at 390px): verification explainer (4 steps), feature sections (verified-only, video listings, featured stories, undercover privacy, department job board, safe exchange), categories, and clear join CTAs.
- Tested: 100% backend (8/8) + 100% frontend (iteration_13), zero issues.

## Backlog (prioritized)
- **P1:** Real ID.me sandbox creds + callback validation; real Twilio SMS creds + delivery (SMS mocked).
- **P2:** Activate a real listing fee (bills through existing Stripe layer); moderation enhancements (report detail drawer, member report history); optional dedicated /jobs view; refactor server.py (~2600 lines) into router modules.

## Next Tasks
- All core phases (1–10) complete. Await user acceptance; likely next: wire real ID.me/Twilio credentials, or go-live/deploy.

## Implemented (2026-09-22) — Post-login UI restructure: Marketplace Home + Dashboard portal
- **/marketplace rebuilt** as a real large-scale Marketplace Home (redirect target after login + after verification for approved users). New `MarketHeader` (sticky utility bar, real First Unit logo, category-dropdown search, Orders/Messages(+unread badge)/Alerts icons, red Sell, Dashboard button, profile chip) + text category nav row. Body: left filter rail (live category counts, price min/max, condition, distance, has-video/featured — all filter the real live set), right column (rotating promo carousel, Shop-by-Category tiles from real category data, Featured Stories rail reusing Stories, curated shelves Picks/Trending/Because-you-viewed[localStorage]/Near-You/New-Today with See-all + a Boost CTA band), and a mega-footer.
- **/dashboard portal** added (`RequireApproved`): dark navy sidebar (Marketplace, My Listings, Offers & Orders, Messages, Saved · Community: Members, Job Board · Account: Verification, Profile) + mini profile block; top bar reuses MarketHeader. Content = user's own Stories row, stats, and My Listings, reusing existing components; Saved = localStorage watchlist; Job Board view. External nav links route to existing pages — pure navigation/visual shell, no feature changes.
- **Reliability**: `imgFallback` + designed navy PLACEHOLDER_IMG (SVG) on listing/story/category images (no broken-image icons); TEST_-prefixed listings/stories filtered from these views; "Message seller" already opens real threads. Fully responsive (filter rail hidden <980px; header search drops to its own row + icon-only buttons <620px; zero horizontal overflow at 390px).
- NO backend changes — reused GET /listings, /stories, /jobs, /profile/me, /listings/mine, /messages/unread-count, /notifications.
- Tested: iteration_14 (95% → one HIGH mobile-header overflow) then iteration_15 (100%, zero overflow). All acceptance criteria met.

## Implemented (2026-09-22) — Site-wide design consistency pass (Marketplace/Dashboard design → every page)
- **Unified header everywhere**: `AppNav` now renders `MarketHeader`, so every logged-in page carries the identical header (real logo, category search, Orders/Messages/Alerts badges, Sell, Dashboard, profile chip, logout). Pages updated: Marketplace, Dashboard (+ My Listings/Saved/Job Board views), Listing Detail, Messages inbox, Conversation thread, Transactions (Offers & Orders), Members directory, Member profile, My Profile, Verification, Sell wizard, Admin console.
- **Full-width layout**: `.fu-app:has(.mh) .wrap { max-width:100% }` makes all logged-in pages edge-to-edge (landing untouched via :has scoping).
- **Listing Detail** rebuilt with new header + full width; video keeps a poster + onError fallback; "Message seller" opens real threads (no "coming soon").
- **Reliability**: `fileUrl` passes through absolute URLs; `imgFallback` + navy `PLACEHOLDER_IMG` SVG on all listing/story/tile/gallery images (no broken icons); category tiles render full-width hero images (fixed flex-column button).
- **Data**: backend `GET /listings` and `get_stories` exclude `^test_` titles at query level; 9 TEST_ listings deleted; ~11 demo listings seeded across gear/vehicles/art with real images + 3 video-backed stories so shelves/tiles/stories look populated.
- **Auth**: Login & Register split-screen with real first-responder hero image + gradient overlay + logo/tagline, theme-matched, stacks on mobile.
- Verified: iteration_16 (100% backend 12/12, frontend ~95%), iteration_18 (category tiles 100%). Only non-blocking nit: tile image height ~125px vs 150px.

## Historical backlog (pre-Phase 7)
