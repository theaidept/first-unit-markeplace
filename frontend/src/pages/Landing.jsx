import { useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  X,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { AvatarRing } from "../components/AvatarRing";
import { Reveal } from "../components/Reveal";
import { StoryViewer } from "../components/StoryViewer";
import { Footer } from "../components/Footer";
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

const COLLAGE = [
  STORY_IMG["Duty Belt Set"],
  STORY_IMG["'19 Rescue Truck"],
  "https://images.pexels.com/photos/34136293/pexels-photo-34136293.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
];

const STORIES = [
  { id: "duty", title: "Duty Belt Set", price: 85, photo: STORY_IMG["Duty Belt Set"], handle: "Engine 14" },
  { id: "ring", title: "Academy Ring", price: 310, photo: STORY_IMG["Academy Ring"], handle: "PD Unit 22" },
  { id: "art", title: "Station Art Print", price: 60, photo: STORY_IMG["Station Art Print"], handle: "Station 9" },
  { id: "truck", title: "'19 Rescue Truck", price: 41000, photo: STORY_IMG["'19 Rescue Truck"], handle: "Engine 14" },
  { id: "medic", title: "Medic Bag — Full", price: 150, photo: STORY_IMG["Medic Bag — Full"], handle: "Station 9 EMS" },
  { id: "headset", title: "Dispatch Headset", price: 45, photo: STORY_IMG["Dispatch Headset"], handle: "Dispatch 4" },
].map((s) => ({ ...s, seller: { display_handle: s.handle, verified_badge: true } }));

const CATS = [
  ["Gear & Equipment", "1,204 listings", STORY_IMG["Duty Belt Set"]],
  ["Vehicles", "86 listings", STORY_IMG["'19 Rescue Truck"]],
  ["Art & Personal Items", "512 listings", STORY_IMG["Academy Ring"]],
  ["Department Jobs", "39 open roles", "https://images.pexels.com/photos/34136293/pexels-photo-34136293.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"],
];

const COMMUNITY_IMG = "https://images.unsplash.com/photo-1637590110484-03778d227a0d?auto=format&fit=crop&w=1800&q=80";

function StoryRail({ onOpen }) {
  const scroller = useRef(null);
  const nudge = (dir) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector(".story-card");
    const step = (card ? card.offsetWidth : 92) + 28;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };
  return (
    <div className="slide-rail landing-stories">
      <button type="button" className="slide-arrow prev" aria-label="Previous stories" onClick={() => nudge(-1)}>
        <ChevronLeft size={18} />
      </button>
      <div className="slide-viewport" ref={scroller}>
        <div className="landing-story-track">
          {STORIES.map((s, i) => (
            <button className="story-card" key={s.id} onClick={() => onOpen(i)} data-testid={`landing-story-${s.id}`}>
              <span className="sc-ring">
                <span className="sc-thumb" style={{ backgroundImage: `url(${s.photo})` }}>
                  <span className="sc-play"><Play size={16} fill="currentColor" /></span>
                </span>
              </span>
              <span className="sc-handle">{s.handle}</span>
              <span className="sc-price">${s.price.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="slide-arrow next" aria-label="Next stories" onClick={() => nudge(1)}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default function Landing() {
  const reduce = useReducedMotion();
  const [viewer, setViewer] = useState(null);
  const [watch, setWatch] = useState(false);
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

          <motion.button
            type="button"
            className="hero-card"
            data-testid="hero-watch"
            onClick={() => setWatch(true)}
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
              <span className="hero-play" aria-hidden><Play size={26} fill="currentColor" /></span>
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
                  <div className="hero-seller-name">Engine 14 · Firefighter</div>
                  <VerifiedBadge />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>2h ago</div>
            </div>

            <div className="hc-badge" aria-hidden>
              <ShieldCheck size={22} />
            </div>
          </motion.button>
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
              <div className="feature-copy">
                <div className="ico">
                  <ShieldCheck />
                </div>
                <h3>{USPS[0].title}</h3>
                <p>{USPS[0].body}</p>
                <VerifiedBadge label="Every member verified" />
              </div>
              <div className="feature-collage" aria-hidden>
                {COLLAGE.map((src) => (
                  <img key={src} src={src} alt="" />
                ))}
              </div>
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
          <StoryRail onOpen={setViewer} />
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
      <section className="community-band pull-up">
        <img className="cb-photo" src={COMMUNITY_IMG} alt="" />
        <span className="cb-shade" aria-hidden />
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
            {CATS.map(([name, count, photo], i) => (
              <Reveal key={name} delay={i * 0.06}>
                <div className="cat-tile">
                  <span className="ct-img">
                    <img src={photo} alt="" />
                    <span className="ct-copy">
                      <span className="ct-label">{name}</span>
                      <span className="ct-count">{count}</span>
                    </span>
                  </span>
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
          <span className="eyebrow tick">
            Join the founding circle
          </span>
          <h2>
            You already wear the badge.
            <br />
            Now trade inside it.
          </h2>
          <p className="cta-support">
            Verification is free for active and retired law enforcement, fire, EMS, and dispatch. No civilians.
          </p>
          <Link to="/register" className="btn btn-primary" data-testid="cta-start-btn">
            Start Verification →
          </Link>
        </div>
      </section>

      <Footer />
      {viewer !== null && (
        <StoryViewer stories={STORIES} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />
      )}
      {watch && (
        <div className="watch-modal" data-testid="hero-video-modal" onClick={() => setWatch(false)}>
          <div className="watch-frame" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="watch-close" onClick={() => setWatch(false)} aria-label="Close video" data-testid="hero-video-close"><X size={18} /></button>
            <div className="watch-video">
              <iframe
                title="Turnout Gear listing video"
                src="https://www.youtube.com/embed/Xy-UQ-J9mhs?autoplay=1&rel=0&modestbranding=1&playsinline=1"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="watch-meta">
              <div>
                <div className="watch-title">Turnout Gear — Size L</div>
                <div className="watch-price">$240</div>
              </div>
              <div className="watch-actions">
                <Link to="/login" className="btn btn-primary" data-testid="hero-buy-now"><ShoppingBag size={15} /> Buy Now</Link>
                <Link to="/login" className="btn btn-ghost" data-testid="hero-offer"><Tag size={15} /> Offer</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
