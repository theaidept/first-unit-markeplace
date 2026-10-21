import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { fileUrl } from "../lib/api";
import { openAd, trackView } from "../lib/ads";
import { VerifiedBadge } from "./VerifiedBadge";
import { AvatarRing } from "./AvatarRing";
import { X, ShoppingBag, ChevronLeft, ChevronRight, Play, Volume2, VolumeX, Tag } from "lucide-react";

const SWIPE = 45; // px threshold to register a swipe

export const StoryViewer = ({ stories, index, onClose, onIndex }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const videoRef = useRef(null);
  const touch = useRef({ x: 0, y: 0, t: 0, moved: false });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = back
  const progressRef = useRef(0);

  const s = stories[index];

  const next = useCallback(() => {
    if (index < stories.length - 1) {
      setDir(1);
      onIndex(index + 1);
    } else {
      onClose();
    }
  }, [index, stories.length, onIndex, onClose]);

  const prev = useCallback(() => {
    if (index > 0) {
      setDir(-1);
      onIndex(index - 1);
    }
  }, [index, onIndex]);

  // Reset transient state whenever the active story changes.
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
    setPaused(false);
    const cur = stories[index];
    if (cur?.ad) trackView(cur.ad);
  }, [index, stories]);

  // Photo-only stories (landing reel) advance on a timer. Video stories use playback time.
  useEffect(() => {
    const current = stories[index];
    if (!current || current.video || paused) return undefined;
    const startProgress = progressRef.current;
    const started = Date.now();
    let done = false;
    const id = setInterval(() => {
      const p = Math.min(1, startProgress + (Date.now() - started) / 5000);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1 && !done) {
        done = true;
        next();
      }
    }, 80);
    return () => clearInterval(id);
  }, [index, paused, stories, next]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, prev, onClose]);

  if (!s) return null;
  const seller = s.seller || {};
  const isAd = Boolean(s.ad || s.kind === "ad");

  const shop = () => {
    onClose();
    if (isAd) { openAd(s.ad, navigate); return; }
    if (!user) navigate("/login");
    else if (s.listing_id) navigate(`/listing/${s.listing_id}`);
    else navigate("/marketplace");
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) { setPaused((p) => !p); return; }
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };

  const onTimeUpdate = (e) => {
    const v = e.currentTarget;
    if (v.duration) setProgress(v.currentTime / v.duration);
  };

  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
  };
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return; // treated as a tap by zones
    touch.current.moved = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next() : prev();
    } else {
      if (dy > 0) onClose();   // swipe down to dismiss
      else next();             // swipe up for next
    }
  };

  const zoneTap = (fn) => () => {
    if (touch.current.moved) { touch.current.moved = false; return; }
    fn();
  };

  const variants = {
    enter: (d) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 60, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (d) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -60, scale: 0.98 }),
  };

  return (
    <div className="story-modal" data-testid="story-viewer" onClick={onClose}>
      <div
        className="story-stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Segmented progress — position in the reel + live playback of the current story */}
        <div className="story-progress" data-testid="story-progress">
          {stories.map((st, i) => (
            <span className="sp-seg" key={st.id}>
              <span
                className="sp-seg-fill"
                style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        <button className="story-close" onClick={onClose} data-testid="story-close"><X size={18} /></button>
        <button className="story-mute" onClick={() => setMuted((m) => !m)} data-testid="story-mute" aria-label="Mute">
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={s.id}
            className="story-slide"
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.15 } : { type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.32 }}
          >
            {s.video ? (
              <video
                ref={videoRef}
                src={fileUrl(s.video)}
                autoPlay
                playsInline
                muted={muted}
                className="story-video"
                data-testid="story-video"
                poster={s.photo ? fileUrl(s.photo) : undefined}
                onTimeUpdate={onTimeUpdate}
                onEnded={next}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
              />
            ) : (
              <img className="story-video" alt="" src={fileUrl(s.photo) || undefined} data-testid="story-photo" />
            )}

            {/* Tap zones: left=prev, center=play/pause, right=next */}
            <div className="story-zones">
              <div className="story-zone" onClick={zoneTap(prev)} data-testid="story-zone-prev" />
              <div className="story-zone center" onClick={zoneTap(togglePlay)} data-testid="story-zone-playpause" />
              <div className="story-zone" onClick={zoneTap(next)} data-testid="story-zone-next" />
            </div>

            {/* Persistent, prominent shoppable product card */}
            <div className="story-overlay" data-testid="story-overlay">
              <div className="so-seller">
                <AvatarRing size="sm" src={seller.avatar} />
                <span>{seller.display_handle}</span>
                {seller.verified_badge && <VerifiedBadge />}
                {isAd && <span className="native-ad-badge sm">Sponsored</span>}
              </div>
              <motion.div
                className="story-buy-card"
                data-testid="story-buy-card"
                initial={reduce ? false : { y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: reduce ? 0 : 0.12, duration: 0.3, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sbc-thumb" style={{ backgroundImage: s.photo ? `url(${fileUrl(s.photo)})` : undefined }} />
                <div className="sbc-info">
                  <div className="so-title">{s.title}</div>
                  {s.price ? <div className="so-price">${Number(s.price).toLocaleString()}</div> : null}
                </div>
                {(!isAd || s.ad?.show_cta === true) && (
                  <div className="sbc-actions">
                    <button className="btn btn-primary sbc-btn" onClick={shop} data-testid="story-buy-btn">
                      <ShoppingBag size={14} /> {isAd ? (s.ad?.cta || "Shop now") : "Buy Now"}
                    </button>
                    {!isAd && (
                      <button className="btn btn-ghost sbc-btn" onClick={shop} data-testid="story-offer-btn">
                        <Tag size={14} /> Offer
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Transient center play/pause indicator */}
        <AnimatePresence>
          {paused && (
            <motion.div
              className="story-playpause"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              data-testid="story-paused-indicator"
            >
              <Play size={30} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>

        {index > 0 && (
          <button className="story-nav left" onClick={prev} data-testid="story-prev"><ChevronLeft size={26} /></button>
        )}
        {index < stories.length - 1 && (
          <button className="story-nav right" onClick={next} data-testid="story-next"><ChevronRight size={26} /></button>
        )}
      </div>
    </div>
  );
};
