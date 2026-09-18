import { useNavigate } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <div className="fu-app" data-testid="payment-cancel-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 620 }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <XCircle size={42} color="var(--text-faint)" />
          <h1 className="oswald" style={{ color: "var(--navy)", margin: "16px 0 6px" }}>Boost not purchased</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 22 }}>
            You cancelled checkout, so no charge was made. Your listing is still published — you can add a boost anytime.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate("/marketplace")} data-testid="cancel-go-marketplace-btn">
              Go to marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
