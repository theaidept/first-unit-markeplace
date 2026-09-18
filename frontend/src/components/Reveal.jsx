import { useEffect, useRef, useState } from "react";

// Lightweight scroll-reveal (IntersectionObserver, no external lib).
// Once revealed it stays visible — never leaves content faded.
export const Reveal = ({ children, className = "", delay = 0, as: Tag = "div", ...props }) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}s` }}
      {...props}
    >
      {children}
    </Tag>
  );
};
