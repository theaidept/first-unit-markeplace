import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import api, { formatApiErrorDetail } from "../lib/api";

export default function VerificationCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [msg, setMsg] = useState("Finishing verification with ID.me…");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");
    const run = async () => {
      if (err || !code || !state) {
        setMsg("Verification was cancelled. Redirecting…");
        setTimeout(() => navigate("/verification"), 1500);
        return;
      }
      try {
        await api.get("/verification/idme/callback", { params: { code, state } });
        await refreshUser();
      } catch (e) {
        setMsg(formatApiErrorDetail(e.response?.data?.detail) || "Verification error");
      } finally {
        setTimeout(() => navigate("/verification"), 800);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="center-screen" data-testid="verification-callback">
      <div style={{ textAlign: "center" }}>
        <Brand />
        <p style={{ marginTop: 20, letterSpacing: 0 }}>{msg}</p>
      </div>
    </div>
  );
}
