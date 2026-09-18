import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  Video,
  Sparkles,
  EyeOff,
  Briefcase,
  Clock,
  Play,
  BadgeCheck,
  ShoppingBag,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { AvatarRing } from "../components/AvatarRing";
import { Reveal } from "../components/Reveal";
import { IMG, STORY_IMG } from "../lib/assets";

const USPS = [
  {
    icon: ShieldCheck,
    title: "Verified-only membership",
    body: "Every account is checked against agency records through ID.me, with a human reviewer on edge cases. No verification, no marketplace access.",
  },
  {
    icon: Video,
    title: "Video-linked listings",
    body: "Record a quick walkaround of what you're selling. The clip stays attached to the listing so buyers see the item, not just photos.",
  },
  {
    icon: Sparkles,
    title: "Featured stories",
    body: "Standout listings surface at the top of the feed as a story reel — tap in to watch the video, then jump straight to checkout.",
  },
  {
    icon: EyeOff,
    title: "Undercover-safe privacy",
    body: "Verified members can stay visually anonymous — initials or an avatar instead of a photo — without losing their verified badge.",
  },
  {
    icon: Briefcase,
    title: "Department job board",
    body: "Agencies post open positions free of charge alongside the marketplace — recruiting inside the same trusted network.",
  },
  {
    icon: Clock,
    title: "Safe exchange guidance",
    body: "Suggested station-adjacent meet-up points and reporting tools, built into every transaction from day one.",
  },
];

const STEPS = [
  { n: "01", t: "Tell us who you are", p: "Agency, credential number, rank, and years of service." },
  { n: "02", t: "We check the record", p: "Cross-referenced against authoritative databases via ID.me." },
  { n: "03", t: "A human confirms edge cases", p: "Anything ambiguous is routed to manual review — a real person." },
  { n: "04", t: "You're in", p: "Account activates on approval, with a text and email at every step." },
];

const STORIES = [
  ["Duty Belt Set", "$85"],
  ["Academy Ring", "$310"],
  ["Station Art Print", "$60"],
  ["'19 Rescue Truck", "$41,000"],
  ["Medic Bag — Full", "$150"],
  ["Dispatch Headset", "$45"],
];
const SEG = [3, 1, 2, 4, 2, 5];

const CATS = [
  ["Gear & Equipment", "1,204 listings", "c1"],
  ["Vehicles", "86 listings", "c2"],
  ["Art & Personal Items", "512 listings", "c3"],
  ["Department Jobs", "39 open roles", "c4"],
];

export default function Landing() {
  const reduce = useReducedMotion();
  return (
    <div className="fu-app" data-testid="landing-page">
      <header className="site-header">
        <div className="wrap inner">
          <Brand />
          <div className="header-actions">
            <Link to="/login" className="btn btn-ghost" data-testid="landing-signin-btn">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary" data-testid="landing-join-btn">
              Verify & Join Free
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <span className="hero-top-rule" aria-hidden />
        <span className="grain" aria-hidden />
        <div className="wrap hero-grid">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow tick">Verified First Responders Only</span>
            <h1>
              Buy and sell inside
              <br />a circle that already
              <br />
              <em>trusts each other.</em>
            </h1>
            <p className="lede">
              Every member on First Unit is a verified active or retired officer,
              firefighter, EMT, or dispatcher. No strangers, no guessing — just the
              badge of trust you already share.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary" data-testid="hero-join-btn">
                Verify & Join Free
              </Link>
              <a href="#how" className="btn btn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>
                See how verification works
              </a>
            </div>
            <div className="trust-row">
              <div className="item">
                <ShieldCheck /> ID.me verified
              </div>
              <div className="item">
                <BadgeCheck /> Human-reviewed
              </div>
              <div className="item">
                <ShieldCheck /> Police · Fire · EMS · Dispatch
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-card"
            initial={reduce ? false : { opacity: 0, y: 30 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="hc-progress" aria-hidden>
              <span className="active" />
              <span />
              <span />
            </div>
            <div className="media" style={{ backgroundImage: `url(${IMG.heroGear})` }}>
              <div className="play-pill">
                <span className="dot" />
                WATCH LISTING
              </div>
              <div className="card-foot">
                <div className="item-name">Turnout Gear — Size L</div>
                <div className="item-price">$240</div>
              </div>
            </div>
            <div className="seller-strip">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AvatarRing size="sm" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>Engine 14 · Firefighter</div>
                  <VerifiedBadge />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>2h ago</div>
            </div>

            <div className="hc-badge" aria-hidden>
              <ShieldCheck size={22} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHY — bento */}
      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow tick">Why First Unit</span>
            <h2>Built different, on purpose.</h2>
            <p>
              Every feature exists to protect trust inside the community — not to chase
              generic marketplace growth.
            </p>
          </Reveal>

          <div className="why-bento">
            {/* Feature: verification */}
            <Reveal className="bento feature">
              <div className="ico">
                <ShieldCheck />
              </div>
              <h3>{USPS[0].title}</h3>
              <p>{USPS[0].body}</p>
              <VerifiedBadge label="Every member verified" />
            </Reveal>

            <Reveal className="bento" delay={0.05}>
              <div className="ico red">
                <Video />
              </div>
              <h3>{USPS[1].title}</h3>
              <p>{USPS[1].body}</p>
            </Reveal>

            <Reveal className="bento" delay={0.1}>
              <div className="ico gold">
                <Sparkles />
              </div>
              <h3>{USPS[2].title}</h3>
              <p>{USPS[2].body}</p>
            </Reveal>

            <Reveal className="bento dark" delay={0.05}>
              <div className="ico">
                <EyeOff />
              </div>
              <h3>{USPS[3].title}</h3>
              <p>{USPS[3].body}</p>
            </Reveal>

            <Reveal className="bento" delay={0.1}>
              <div className="ico navy">
                <Briefcase />
              </div>
              <h3>{USPS[4].title}</h3>
              <p>{USPS[4].body}</p>
            </Reveal>

            <Reveal
              className="bento gold"
              style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", minHeight: 118, justifyContent: "flex-start", gap: 22 }}
            >
              <div className="ico gold" style={{ marginBottom: 0, flex: "none" }}>
                <Clock />
              </div>
              <div>
                <h3 style={{ margin: "0 0 6px" }}>{USPS[5].title}</h3>
                <p style={{ maxWidth: 720 }}>{USPS[5].body}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STORIES — shoppable reel */}
      <section className="section stories-section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow tick">Featured this week</span>
            <h2>Tap a story, watch the listing.</h2>
          </Reveal>
          <Reveal className="reel">
            {STORIES.map(([name, price], i) => (
              <div className="sreel" key={name}>
                <div className="thumb" style={{ backgroundImage: `url(${STORY_IMG[name]})` }} />
                <div className="s-progress" aria-hidden>
                  {Array.from({ length: 5 }).map((_, k) => (
                    <i key={k} className={k < SEG[i] ? "on" : ""} />
                  ))}
                </div>
                <div className="s-top">
                  <AvatarRing size="sm" />
                  {i === 0 && (
                    <span className="live">
                      <span className="dot" /> LIVE
                    </span>
                  )}
                </div>
                <div className="play" aria-hidden>
                  <Play size={20} fill="currentColor" />
                </div>
                <div className="s-foot">
                  <div className="nm">{name}</div>
                  <div className="row">
                    <div className="pr">{price}</div>
                    <div className="shop" aria-hidden>
                      <ShoppingBag size={15} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* HOW */}
      <section className="section pull-tight" id="how">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow tick">How verification works</span>
            <h2>Four steps. Full transparency.</h2>
          </Reveal>
          <div className="steps-wrap">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="step">
                  <div className="num">{s.n}</div>
                  <h4>{s.t}</h4>
                  <p>{s.p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY BAND */}
      <section
        className="community-band pull-up"
        style={{ backgroundImage: `url(${IMG.heroGroup})` }}
      >
        <span className="grain" aria-hidden />
        <div className="wrap">
          <span className="eyebrow tick" style={{ color: "#ff8090" }}>
            One community
          </span>
          <h2 className="oswald" style={{ fontSize: 38, margin: "12px 0 14px", maxWidth: 620 }}>
            A verified marketplace where you already know everyone is who they say they are.
          </h2>
          <p style={{ maxWidth: 520, color: "rgba(255,255,255,.8)", lineHeight: 1.6 }}>
            Law enforcement, firefighters, EMTs, paramedics, and dispatchers — active and
            retired. No civilians. No exceptions.
          </p>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow tick">What's on First Unit</span>
            <h2>Gear, art, vehicles — anything but risk.</h2>
            <p>
              Firearms and edged weapons are excluded at launch by policy. Everything else
              your community wants to trade finds a home here.
            </p>
          </Reveal>
          <div className="cats-strip">
            {CATS.map(([name, count, c], i) => (
              <Reveal key={name} delay={i * 0.06}>
                <div className={`cat-tile ${c}`}>
                  <div>
                    <b>{name}</b>
                    <span>{count}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <span className="grain" aria-hidden />
        <div className="wrap">
          <span className="eyebrow tick" style={{ color: "#ff8090" }}>
            Join the founding circle
          </span>
          <h2>
            You already wear the badge.
            <br />
            Now trade inside it.
          </h2>
          <Link to="/register" className="btn btn-primary" data-testid="cta-start-btn">
            Start Verification →
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap row">
          <Brand light />
          <div>© {new Date().getFullYear()} First Unit — Verified first responders only.</div>
        </div>
      </footer>
    </div>
  );
}
