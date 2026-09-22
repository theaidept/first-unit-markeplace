import { useEffect, useState } from "react";
import api from "../lib/api";
import { Briefcase } from "lucide-react";

const recency = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "1d ago";
  if (d < 7) return `${Math.floor(d)}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

export const JobBoard = () => {
  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    api.get("/jobs").then((r) => setJobs(r.data.jobs)).catch(() => setJobs([]));
  }, []);

  return (
    <aside className="job-board card" data-testid="job-board">
      <div className="jb-head">
        <Briefcase size={15} /> Department Job Board
      </div>
      <p className="jb-sub">Open roles posted by agencies in the network.</p>
      {jobs === null ? (
        <div className="jb-empty">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="jb-empty" data-testid="job-board-empty">No open roles right now.</div>
      ) : (
        <ul className="jb-list" data-testid="job-list">
          {jobs.map((j) => (
            <li className="jb-item" key={j.id} data-testid={`job-${j.id}`}>
              <div className="jb-title">{j.title}</div>
              <div className="jb-dept">{j.department}</div>
              <div className="jb-meta">
                <span>{j.location}</span>
                <span className="jb-recency">{recency(j.posted_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};
