import { useEffect, useState } from "react";
import { AppNav } from "../components/AppNav";
import api from "../lib/api";
import { Store } from "lucide-react";

const CHIPS = ["All", "Gear & Equipment", "Vehicles", "Art & Personal", "Has video", "Featured", "Near me"];

export default function Marketplace() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/marketplace/summary").then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  return (
    <div className="fu-app" data-testid="marketplace-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 28 }}>
        <span className="eyebrow">Marketplace</span>
        <div className="filter-chips" style={{ marginTop: 14 }}>
          {CHIPS.map((c, i) => (
            <div className={`chip ${i === 0 ? "active" : ""}`} key={c}>
              {c}
            </div>
          ))}
        </div>

        <div className="shell-empty" data-testid="marketplace-empty-state">
          <div className="ico">
            <Store size={30} />
          </div>
          <h1>The marketplace is coming online</h1>
          <p>
            You're verified and inside the circle. Listings, featured stories, and messaging
            arrive in the next build phase. {summary?.message}
          </p>
        </div>
      </div>
    </div>
  );
}
