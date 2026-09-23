import { Star } from "lucide-react";

export const StarRating = ({ value = 4.6, count, size = 14, showValue = true, testid }) => (
  <span className="star-rating" data-testid={testid} aria-label={`${value} out of 5 stars`}>
    <span className="sr-stars">
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.max(0, Math.min(1, value - i)) * 100;
        return (
          <span className="sr-slot" key={i} style={{ width: size, height: size }}>
            <Star size={size} className="sr-bg" strokeWidth={1.6} />
            <span className="sr-fg" style={{ width: `${pct}%` }}>
              <Star size={size} className="sr-fill" strokeWidth={1.6} />
            </span>
          </span>
        );
      })}
    </span>
    {showValue && <b className="sr-val">{value.toFixed(1)}</b>}
    {count != null && <span className="sr-count">({count} {count === 1 ? "review" : "reviews"})</span>}
  </span>
);
