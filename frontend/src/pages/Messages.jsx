import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ThreadPane } from "./Thread";
import api, { fileUrl } from "../lib/api";
import { MessageSquare, Send } from "lucide-react";
import { PageHero, Empty, Tag } from "../components/AdminKit";
import { SAMPLE_THREADS, SAMPLE_MESSAGES } from "../lib/sampleDesk";

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
};

const stamp = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function SampleThreadPane({ thread, onBack, showBack }) {
  const seed = SAMPLE_MESSAGES[thread.id] || [];
  const [local, setLocal] = useState(seed);
  const [text, setText] = useState("");

  useEffect(() => {
    setLocal(SAMPLE_MESSAGES[thread.id] || []);
    setText("");
  }, [thread.id]);

  const send = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setLocal((prev) => [...prev, { id: `local-${Date.now()}`, mine: true, body, created_at: new Date().toISOString() }]);
    setText("");
  };

  const other = thread.other || {};
  const listing = thread.listing || {};

  return (
    <div className="thread-pane" data-testid="thread-page">
      {showBack && (
        <button className="btn btn-ghost thread-back" onClick={onBack} data-testid="thread-back-btn">
          Messages
        </button>
      )}
      <div className="chat-shell card" data-testid="chat-shell">
        <div className="chat-header">
          <AvatarRing size="md" src={null} initials={other.initials} />
          <div className="ch-who">
            <div className="ch-handle">
              {other.display_handle}
              {other.verified_badge && <VerifiedBadge />}
              <Tag>Sample</Tag>
            </div>
            <div className="ch-listing"><span>{listing.title}</span></div>
          </div>
        </div>
        <div className="chat-body" data-testid="chat-body">
          {local.map((m) => (
            <div className={`bubble-row ${m.mine ? "mine" : "theirs"}`} key={m.id} data-testid={`message-${m.id}`}>
              {!m.mine && <AvatarRing size="sm" src={null} initials={other.initials} />}
              <div className="bubble-col">
                <div className="bubble">{m.body}</div>
                <div className="bubble-time">{stamp(m.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
        <form className="chat-composer" onSubmit={send} data-testid="chat-composer">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            data-testid="message-input"
            maxLength={4000}
          />
          <button className="btn btn-primary" disabled={!text.trim()} data-testid="message-send-btn">
            <Send size={15} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Messages() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [threads, setThreads] = useState(null);
  const [sampleId, setSampleId] = useState(null);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches);

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
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 800px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const live = Array.isArray(threads) ? threads : [];
  const inbox = live.length ? live : SAMPLE_THREADS;
  const usingSamples = Array.isArray(threads) && live.length === 0;
  const activeSample = usingSamples ? inbox.find((t) => t.id === sampleId) || inbox[0] : null;

  useEffect(() => {
    if (!usingSamples) {
      setSampleId(null);
      return;
    }
    setSampleId((id) => id || SAMPLE_THREADS[0]?.id || null);
  }, [usingSamples]);

  const openThread = (t) => {
    if (t.sample) setSampleId(t.id);
    else navigate(`/messages/${t.id}`);
  };

  const activeId = usingSamples ? (activeSample?.id || null) : threadId;

  return (
    <DashboardLayout active="messages" testid="messages-page">
      <div className="ap-page">
      <PageHero kicker="Inbox" title="Messages" copy="Deals start here. Conversations from listings land in this inbox." />
      <div className={`msg-shell ${activeId ? "has-thread" : ""}`} data-testid="msg-shell">
        <aside className="msg-list card" data-testid="thread-list">
          {threads === null ? (
            <div style={{ padding: 24, color: "var(--text-faint)" }}>Loading…</div>
          ) : inbox.length === 0 ? (
            <div data-testid="messages-empty">
              <Empty icon={MessageSquare} title="No messages yet" copy="Message a seller from any listing and the thread will show up here." />
            </div>
          ) : (
            inbox.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`thread-row ${activeId === t.id ? "on" : ""}`}
                onClick={() => openThread(t)}
                data-testid={`thread-row-${t.id}`}
              >
                <AvatarRing size="md" src={t.other?.avatar} initials={t.other?.initials} />
                <div className="tr-main">
                  <div className="tr-top">
                    <span className="tr-handle">
                      {t.other?.display_handle}
                      {t.other?.verified_badge && <VerifiedBadge />}
                      {t.sample && <Tag>Sample</Tag>}
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
              </button>
            ))
          )}
        </aside>

        <section className="msg-pane">
          {usingSamples && activeSample ? (
            <SampleThreadPane thread={activeSample} showBack={narrow} onBack={() => setSampleId(null)} />
          ) : threadId ? (
            <ThreadPane threadId={threadId} showBack={narrow} onBack={() => navigate("/messages")} />
          ) : (
            <div className="dash-empty card msg-pick" data-testid="msg-pick">
              <MessageSquare size={26} color="var(--text-faint)" />
              <h2 className="oswald">Pick a conversation</h2>
              <p>Choose someone on the left to read and reply.</p>
            </div>
          )}
        </section>
      </div>
      </div>
    </DashboardLayout>
  );
}
