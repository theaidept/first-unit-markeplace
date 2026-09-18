import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import { AvatarRing } from "../components/AvatarRing";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { MapPin, ExternalLink, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

const STATUS_PILL = { agreed: "pending", completed: "ok", cancelled: "review" };

export default function Transactions() {
  const navigate = useNavigate();
  const [txs, setTxs] = useState(null);

  const load = async () => {
    const { data } = await api.get("/transactions/mine");
    setTxs(data.transactions);
  };
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    try {
      await api.post(`/transactions/${id}/${action}`);
      toast.success(action === "complete" ? "Marked complete on your side" : "Transaction cancelled");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="fu-app" data-testid="transactions-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 26, maxWidth: 900 }}>
        <span className="eyebrow tick">Deals</span>
        <h1 className="oswald" style={{ fontSize: 30, color: "var(--navy)", margin: "8px 0 6px" }}>Your transactions</h1>
        <p style={{ color: "var(--text-dim)", maxWidth: 640, lineHeight: 1.6, marginBottom: 24 }}>
          First Unit records the agreement and hands off — money moves directly between you and the
          other member through their own PayPal or Venmo. No funds ever pass through First Unit.
        </p>

        {txs === null ? (
          <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
        ) : txs.length === 0 ? (
          <div className="card" style={{ padding: 36, textAlign: "center", color: "var(--text-dim)" }} data-testid="tx-empty">
            No transactions yet. Buy Now or an accepted offer will appear here.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }} data-testid="tx-list">
            {txs.map((t) => (
              <div className="card tx-card" style={{ padding: 20 }} key={t.id} data-testid={`tx-${t.id}`}>
                <div className="tx-top">
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div className="tx-thumb">{t.listing.photo ? <img src={fileUrl(t.listing.photo)} alt="" /> : null}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text)" }}>{t.listing.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                        {t.role === "buyer" ? "Buying from" : "Selling to"} <b>{t.counterparty.display_handle}</b>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="lc-price" style={{ fontSize: 22 }}>${Number(t.agreed_amount).toLocaleString()}</div>
                    <span className={`pill ${STATUS_PILL[t.status]}`}>{t.status}</span>
                  </div>
                </div>

                {t.role === "buyer" && t.status === "agreed" && (
                  <div className="tx-pay" data-testid={`tx-pay-${t.id}`}>
                    <div className="tx-pay-label">Pay {t.counterparty.display_handle} directly:</div>
                    {(t.pay_targets || []).length === 0 ? (
                      <div className="mb-note">This seller hasn't linked a payment account yet.</div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {t.pay_targets.map((pt) => (
                          <a key={pt.method} className="btn btn-primary" href={pt.url} target="_blank" rel="noreferrer"
                             onClick={() => api.post(`/transactions/${t.id}/method`, { payment_method: pt.method }).catch(() => {})}
                             data-testid={`pay-${pt.method}-${t.id}`}>
                            {pt.label} {pt.handle} <ExternalLink size={14} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {t.meetup_note && (
                  <div className="tx-meetup"><MapPin size={14} /> {t.meetup_note}</div>
                )}

                <div className="tx-actions">
                  <span className="tx-flags">
                    {t.buyer_completed && <span><CheckCircle2 size={13} /> Buyer confirmed</span>}
                    {t.seller_completed && <span><CheckCircle2 size={13} /> Seller confirmed</span>}
                  </span>
                  {t.status === "agreed" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => act(t.id, "cancel")} data-testid={`tx-cancel-${t.id}`}>
                        <XCircle size={14} /> Cancel
                      </button>
                      <button className="btn btn-primary" onClick={() => act(t.id, "complete")} data-testid={`tx-complete-${t.id}`}>
                        <ShieldCheck size={14} /> Mark complete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
