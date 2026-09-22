import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import api, { fileUrl } from "../lib/api";
import { MessageSquare } from "lucide-react";

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
};

export default function Messages() {
  const [threads, setThreads] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/threads");
      setThreads(data.threads);
    } catch {
      setThreads([]);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // poll inbox
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fu-app" data-testid="messages-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 26, maxWidth: 760 }}>
        <span className="eyebrow tick">Messages</span>
        <h1 className="oswald" style={{ fontSize: 30, color: "var(--navy)", margin: "8px 0 20px" }}>
          Your conversations
        </h1>

        {threads === null ? (
          <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
        ) : threads.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }} data-testid="messages-empty">
            <MessageSquare size={26} color="var(--text-faint)" />
            <div style={{ marginTop: 10 }}>No conversations yet. Message a seller from any listing to start one.</div>
          </div>
        ) : (
          <div className="thread-list" data-testid="thread-list">
            {threads.map((t) => (
              <Link to={`/messages/${t.id}`} className="thread-row" key={t.id} data-testid={`thread-row-${t.id}`}>
                <AvatarRing size="md" src={t.other?.avatar} initials={t.other?.initials} />
                <div className="tr-main">
                  <div className="tr-top">
                    <span className="tr-handle">
                      {t.other?.display_handle}
                      {t.other?.verified_badge && <VerifiedBadge />}
                    </span>
                    <span className="tr-time">{timeAgo(t.last_message_at || t.updated_at)}</span>
                  </div>
                  <div className="tr-listing">
                    {t.listing?.photo && <img src={fileUrl(t.listing.photo)} alt="" />}
                    <span>{t.listing?.title}</span>
                  </div>
                  <div className="tr-preview">{t.last_message || "No messages yet"}</div>
                </div>
                {t.unread_count > 0 && <span className="tr-unread" data-testid={`thread-unread-${t.id}`}>{t.unread_count}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
