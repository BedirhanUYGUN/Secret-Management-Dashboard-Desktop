import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../types";
import { useState } from "react";

export function LoginPage() {
  const navigate = useNavigate();
  const { loginAsRole, loading } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");

  const signIn = async (role: Role) => {
    setErrorMessage("");
    try {
      await loginAsRole(role);
      navigate("/projects", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Login failed.");
      }
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Company Access</h1>
        <p>Select a role simulation for MVP routing and permissions.</p>
        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        <div className="login-actions">
          <button type="button" onClick={() => void signIn("admin")} disabled={loading}>
            Continue as Admin
          </button>
          <button type="button" onClick={() => void signIn("member")} disabled={loading}>
            Continue as Member
          </button>
          <button type="button" onClick={() => void signIn("viewer")} disabled={loading}>
            Continue as Viewer
          </button>
        </div>
      </section>
    </div>
  );
}
