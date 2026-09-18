import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import api from "../lib/api";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

const MAX_TRIES = 8;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [state, setState] = useState("checking"); // checking | paid | timeout | error
  const [listingId, setListingId] = useState(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      return;
    }
    let stop = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (stop) return;
        setListingId(data?.metadata?.listing_id || null);
        if (data.payment_status === "paid") {
          setState("paid");
          return;
        }
        if (data.status === "expired" || data.payment_status === "failed") {
          setState("error");
          return;
        }
        tries.current += 1;
        if (tries.current >= MAX_TRIES) {
          setState("timeout");
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        if (!stop) setState("error");
      }
    };
    poll();
    return () => { stop = true; };
  }, [sessionId]);

  return (
    <div className="fu-app" data-testid="payment-success-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 620 }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          {state === "checking" && (
            <div data-testid="payment-checking">
              <Loader2 size={38} className="spin" color="var(--navy)" />
              <h1 className="oswald" style={{ color: "var(--navy)", margin: "16px 0 6px" }}>Confirming your boost…</h1>
              <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Verifying your payment with Stripe. This only takes a moment.</p>
            </div>
          )}
          {state === "paid" && (
            <div data-testid="payment-paid">
              <CheckCircle2 size={44} color="#1b8a4b" />
              <h1 className="oswald" style={{ color: "var(--navy)", margin: "16px 0 6px" }}>Boost active</h1>
              <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 22 }}>
                Your listing is now <b>FEATURED</b> and has priority placement in the Featured Stories reel.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {listingId && (
                  <button className="btn btn-primary" onClick={() => navigate(`/listing/${listingId}`)} data-testid="view-boosted-listing-btn">
                    View listing
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => navigate("/marketplace")} data-testid="go-marketplace-btn">
                  Go to marketplace
                </button>
              </div>
            </div>
          )}
          {(state === "timeout" || state === "error") && (
            <div data-testid="payment-error">
              <AlertTriangle size={40} color="var(--red)" />
              <h1 className="oswald" style={{ color: "var(--navy)", margin: "16px 0 6px" }}>
                {state === "timeout" ? "Still processing" : "We couldn't confirm the payment"}
              </h1>
              <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 22 }}>
                {state === "timeout"
                  ? "Your payment is taking a little longer than usual. Your boost will apply automatically once it clears."
                  : "No payment session was found. If you were charged, your boost will apply automatically."}
              </p>
              <button className="btn btn-primary" onClick={() => navigate("/marketplace")} data-testid="error-go-marketplace-btn">
                Back to marketplace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
