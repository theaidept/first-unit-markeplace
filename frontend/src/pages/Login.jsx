import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAuth, formatApiErrorDetail } from "../context/AuthContext";
import { IMG } from "../lib/assets";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u.verification_status === "approved") navigate("/marketplace");
      else navigate("/verification");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell" data-testid="login-page">
      <div className="auth-side" style={{ backgroundImage: `url(${IMG.verifySide})` }}>
        <Brand light />
        <div>
          <h2>Welcome back to the unit.</h2>
          <p>
            Sign in to reach the verified marketplace. Only approved first responders can
            see listings, stories, and members.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>
          Verified · Human-reviewed · Trusted
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="sub">Verified first responders only.</p>
          {error && (
            <div className="form-error" data-testid="login-error">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.gov"
                required
                data-testid="login-email-input"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="login-password-input"
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading} data-testid="login-submit-btn">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="auth-alt">
            <Link to="/forgot-password" data-testid="forgot-link">
              Forgot password?
            </Link>
          </div>
          <div className="auth-alt">
            New here? <Link to="/register" data-testid="to-register-link">Verify & join free</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
