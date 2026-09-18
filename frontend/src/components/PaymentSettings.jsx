import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { CreditCard, ExternalLink } from "lucide-react";

export const PaymentSettings = () => {
  const [p, setP] = useState(null);
  const [f, setF] = useState({ paypal_me: "", paypal_email: "", venmo_handle: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/payments/me");
    setP(data);
    setF({ paypal_me: data.paypal_me || "", paypal_email: data.paypal_email || "", venmo_handle: data.venmo_handle || "" });
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/payments/me", f);
      setP(data);
      toast.success("Payment accounts saved");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setSaving(false); }
  };
  const connect = async () => {
    try {
      const { data } = await api.post("/payments/paypal/start");
      if (data.mode === "redirect") window.location.href = data.url;
      else toast.info(data.message || "Add your PayPal.me handle below.");
    } catch { toast.error("Could not start PayPal connect"); }
  };
  if (!p) return null;

  return (
    <div style={{ marginTop: 36 }} data-testid="payment-settings">
      <span className="eyebrow tick">Payment accounts · Lane A</span>
      <h2 className="oswald" style={{ fontSize: 24, color: "var(--navy)", margin: "8px 0 6px" }}>Get paid off-platform</h2>
      <p style={{ color: "var(--text-dim)", maxWidth: 640, lineHeight: 1.6 }}>
        Buyers pay you directly through your own PayPal or Venmo. First Unit never holds your money.{" "}
        {p.paypal_connected && <b style={{ color: "#1f7a44" }} data-testid="paypal-linked">PayPal linked ✓</b>}
      </p>
      <form onSubmit={save} className="card" style={{ padding: 24, marginTop: 14, maxWidth: 640 }}>
        <button type="button" className="btn btn-steel" onClick={connect} data-testid="paypal-connect-btn">
          <CreditCard size={16} /> Connect with PayPal <ExternalLink size={13} />
        </button>
        {!p.oauth_available && (
          <div className="mb-note" style={{ margin: "10px 0 4px" }}>
            Connect-with-PayPal activates once API keys are added. For now, link your PayPal.me handle below — an honest, working alternative.
          </div>
        )}
        <div className="field" style={{ marginTop: 14 }}>
          <label>PayPal.me handle</label>
          <input value={f.paypal_me} onChange={set("paypal_me")} placeholder="e.g. Engine14Mike" data-testid="pay-paypalme" />
        </div>
        <div className="field">
          <label>PayPal email (optional)</label>
          <input value={f.paypal_email} onChange={set("paypal_email")} placeholder="you@example.com" data-testid="pay-paypal-email" />
        </div>
        <div className="field">
          <label>Venmo handle</label>
          <input value={f.venmo_handle} onChange={set("venmo_handle")} placeholder="e.g. engine14-mike" data-testid="pay-venmo" />
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
            Venmo has no connect API — we capture your handle and generate a payment deep-link.
          </div>
        </div>
        <button className="btn btn-primary" disabled={saving} data-testid="pay-save-btn">
          {saving ? "Saving…" : "Save payment accounts"}
        </button>
      </form>
    </div>
  );
};
