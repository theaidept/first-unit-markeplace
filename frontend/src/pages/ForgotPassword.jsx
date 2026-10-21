import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import api, { formatApiErrorDetail } from "../lib/api";
import { IMG } from "../lib/assets";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(data.message || "If that account exists, a reset link has been sent.");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell" data-testid="forgot-page">
      <div className="auth-side" style={{ backgroundImage: `linear-gradient(155deg, rgba(11,31,66,.74), rgba(13,20,36,.9)), url(${IMG.verifySide})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <Brand light />
        <div>
          <h2>Reset Your Password</h2>
          <p>We'll email a secure link to reset your First Unit password. It expires in one hour.</p>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>
          Secure link · One hour to use it
        </div>
      </div>
      <div className="auth-main auth-panel">
        <div className="auth-card">
          <h1>Forgot password</h1>
          <p className="sub">Enter the email on your account.</p>
          {msg && <div className="form-ok" data-testid="forgot-success">{msg}</div>}
          {error && <div className="form-error" data-testid="forgot-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.gov"
                required
                data-testid="forgot-email-input"
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading} data-testid="forgot-submit-btn">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <div className="auth-foot">
            <div className="auth-alt">
              <Link to="/login" data-testid="back-to-login-link">Back to sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
