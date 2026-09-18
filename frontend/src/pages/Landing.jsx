import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Video,
  Sparkles,
  EyeOff,
  Briefcase,
  Clock,
  Play,
  BadgeCheck,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { AvatarRing } from "../components/AvatarRing";
import { IMG } from "../lib/assets";

const USPS = [
  {
    icon: ShieldCheck,
    feat: true,
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

const CATS = [
  ["Gear & Equipment", "1,204 listings", "c1"],
  ["Vehicles", "86 listings", "c2"],
  ["Art & Personal Items", "512 listings", "c3"],
  ["Department Jobs", "39 open roles", "c4"],
];

export default function Landing() {
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
        <div className="wrap hero-grid">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow">Verified First Responders Only</span>
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
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
          </motion.div>
        </div>
      </section>

      {/* USPS */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Why First Unit</span>
            <h2>Built different, on purpose.</h2>
            <p>
              Every feature exists to protect trust inside the community — not to chase
              generic marketplace growth.
            </p>
          </div>
          <div className="usp-grid">
            {USPS.map((u, i) => (
              <motion.div
                key={u.title}
                className={`usp-card ${u.feat ? "feat" : ""}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <div className="ico">
                  <u.icon />
                </div>
                <h3>{u.title}</h3>
                <p>{u.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STORIES */}
      <section className="section alt">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Featured this week</span>
            <h2>Tap a story, watch the listing.</h2>
          </div>
          <div className="stories-row">
            {STORIES.map(([name, price]) => (
              <div className="story" key={name}>
                <div className="ring">
                  <div className="inner">
                    <Play fill="currentColor" />
                  </div>
                </div>
                <div className="cap">
                  <b>{name}</b>
                  {price}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">How verification works</span>
            <h2>Four steps. Full transparency.</h2>
          </div>
          <div className="steps-wrap">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <div className="num">{s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY BAND */}
      <section
        className="community-band"
        style={{ backgroundImage: `url(${IMG.heroGroup})` }}
      >
        <div className="wrap">
          <span className="eyebrow" style={{ color: "#ff6b7d" }}>
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
          <div className="section-head">
            <span className="eyebrow">What's on First Unit</span>
            <h2>Gear, art, vehicles — anything but risk.</h2>
            <p>
              Firearms and edged weapons are excluded at launch by policy. Everything else
              your community wants to trade finds a home here.
            </p>
          </div>
          <div className="cats-strip">
            {CATS.map(([name, count, c]) => (
              <div className={`cat-tile ${c}`} key={name}>
                <div>
                  <b>{name}</b>
                  <span>{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <div className="wrap">
          <span className="eyebrow" style={{ color: "#ff6b7d" }}>
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
