import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import api, { formatApiErrorDetail } from "../lib/api";
import { IMG } from "../lib/assets";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      setMsg(data.message || "Password updated.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell" data-testid="reset-page">
      <div className="auth-side" style={{ backgroundImage: `url(${IMG.verifySide})` }}>
        <Brand light />
        <div>
          <h2>Choose a new password.</h2>
          <p>Pick something strong. You'll use it to sign in to First Unit.</p>
        </div>
        <div />
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <h1>Reset password</h1>
          <p className="sub">Set a new password for your account.</p>
          {!token && <div className="form-error">This reset link is missing its token.</div>}
          {msg && <div className="form-ok" data-testid="reset-success">{msg}</div>}
          {error && <div className="form-error" data-testid="reset-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                data-testid="reset-password-input"
              />
            </div>
            <button
              className="btn btn-primary btn-block"
              disabled={loading || !token}
              data-testid="reset-submit-btn"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
          <div className="auth-alt">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
