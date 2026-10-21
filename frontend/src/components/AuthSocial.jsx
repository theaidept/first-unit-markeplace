import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { BACKEND } from "../lib/api";

/** Buttons call the backend. They stay quiet until EMERGENT_KEYS.env has real values. */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#111" d="M14.55 9.53c-.03-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.35 2.88 2.31 1.16-.05 1.6-.75 3-.75s1.8.75 3.02.72c1.25-.02 2.04-1.13 2.8-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.72zM12.3 3.2c.64-.77 1.07-1.84.95-2.91-.92.04-2.03.61-2.69 1.38-.59.68-1.1 1.77-.96 2.81 1.02.08 2.07-.52 2.7-1.28z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#F25022" d="M1 1h7.5v7.5H1z" />
      <path fill="#7FBA00" d="M9.5 1H17v7.5H9.5z" />
      <path fill="#00A4EF" d="M1 9.5h7.5V17H1z" />
      <path fill="#FFB900" d="M9.5 9.5H17V17H9.5z" />
    </svg>
  );
}

const PROVIDERS = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "apple", label: "Continue with Apple", Icon: AppleIcon },
  { id: "microsoft", label: "Continue with Microsoft", Icon: MicrosoftIcon },
];

export function AuthSocial({ testIdPrefix }) {
  const [ready, setReady] = useState({});
  useEffect(() => {
    api.get("/auth/providers").then((r) => setReady(r.data || {})).catch(() => setReady({}));
  }, []);
  const start = (id, label) => {
    if (!ready[id]) {
      toast.info(`${label} is waiting for its key in EMERGENT_KEYS.env`);
      return;
    }
    window.location.assign(`${BACKEND}/api/auth/${id}/start`);
  };
  return (
    <div className="auth-social">
      <div className="auth-or">
        <span>or continue with</span>
      </div>
      <div className="auth-social-row">
        {PROVIDERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="auth-social-btn"
            aria-label={label}
            title={label}
            data-testid={`${testIdPrefix}-${id}`}
            onClick={() => start(id, label.replace("Continue with ", ""))}
          >
            <Icon />
          </button>
        ))}
      </div>
    </div>
  );
}
