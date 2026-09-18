import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAuth, formatApiErrorDetail } from "../context/AuthContext";
import { IMG } from "../lib/assets";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate("/verification");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell" data-testid="register-page">
      <div className="auth-side" style={{ backgroundImage: `url(${IMG.verifySide})` }}>
        <Brand light />
        <div>
          <h2>You wear the badge. First Unit checks the badge.</h2>
          <p>
            Create your account, then complete verification. We check your service against
            authoritative records — and we never store your raw credential documents.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>
          Police · Fire · EMS · Dispatch — active & retired
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-card">
          <h1>Verify & Join</h1>
          <p className="sub">Start with your account. Verification comes next.</p>
          {error && (
            <div className="form-error" data-testid="register-error">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@agency.gov"
                required
                data-testid="register-email-input"
              />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="(555) 123-4567"
                required
                data-testid="register-phone-input"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="At least 8 characters"
                required
                data-testid="register-password-input"
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading} data-testid="register-submit-btn">
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>
          <div className="auth-alt">
            Already verified? <Link to="/login" data-testid="to-login-link">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
