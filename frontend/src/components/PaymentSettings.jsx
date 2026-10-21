import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Wallet, Landmark } from "lucide-react";
import { PageHero, Stats, Stat, Panel, PanelHead, Tag, Btn } from "./AdminKit";

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
    <div className="ap-page" data-testid="payment-settings">
      <PageHero
        kicker="Get paid"
        title="Payouts"
        copy="Buyers pay you directly through PayPal or Venmo. First Unit never holds your money. Connect a wallet so a sale can close."
      />
      <Stats>
        <Stat icon={Wallet} label="PayPal" value={p.paypal_connected ? "Linked" : "Off"} tone={p.paypal_connected ? "navy" : ""} />
        <Stat icon={Landmark} label="Venmo" value={f.venmo_handle ? "Handle on file" : "Off"} tone={f.venmo_handle ? "gold" : ""} />
      </Stats>
      <div className="ap-split">
        <Panel>
          <PanelHead title="Wallets" sub="Connect PayPal, then add handles so a buyer can tap pay from an order." extra={p.paypal_connected ? <Tag tone="pay">PayPal linked</Tag> : null} />
          {p.paypal_connected && <b data-testid="paypal-linked" className="ap-muted" style={{ color: "#1f7a44" }}>PayPal linked ✓</b>}
          <div className="ap-compose" style={{ marginBottom: 14 }}>
            <Btn tone="navy" onClick={connect} testid="paypal-connect-btn">
              <CreditCard size={16} /> Connect with PayPal <ExternalLink size={13} />
            </Btn>
          </div>
          {!p.oauth_available && (
            <p className="ap-muted">Connect-with-PayPal activates once API keys are added. For now, link your PayPal.me handle below.</p>
          )}
          <form onSubmit={save} className="ap-stack">
            <div className="field" style={{ margin: 0 }}>
              <label>PayPal.me handle</label>
              <input value={f.paypal_me} onChange={set("paypal_me")} placeholder="e.g. Engine14Mike" data-testid="pay-paypalme" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>PayPal email (optional)</label>
              <input value={f.paypal_email} onChange={set("paypal_email")} placeholder="you@example.com" data-testid="pay-paypal-email" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Venmo handle</label>
              <input value={f.venmo_handle} onChange={set("venmo_handle")} placeholder="e.g. engine14-mike" data-testid="pay-venmo" />
              <p className="ap-muted">Venmo has no connect API — we capture your handle and generate a payment deep-link.</p>
            </div>
            <Btn type="submit" tone="primary" testid="pay-save-btn">{saving ? "Saving…" : "Save payment accounts"}</Btn>
          </form>
        </Panel>
        <Panel>
          <PanelHead title="How a payout works" />
          <div className="ap-steps">
            <div><em>1</em><div><b>Connect</b><small>PayPal or a Venmo handle on this page.</small></div></div>
            <div><em>2</em><div><b>Close a deal</b><small>Buy Now or an accepted offer becomes an order.</small></div></div>
            <div><em>3</em><div><b>Buyer pays you</b><small>They tap PayPal or Venmo from the order. Money never sits with First Unit.</small></div></div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
