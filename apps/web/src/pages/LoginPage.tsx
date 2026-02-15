import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../types";

export function LoginPage() {
  const navigate = useNavigate();
  const { loginAsRole } = useAuth();

  const signIn = (role: Role) => {
    loginAsRole(role);
    navigate("/projects", { replace: true });
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Company Access</h1>
        <p>Select a role simulation for MVP routing and permissions.</p>
        <div className="login-actions">
          <button type="button" onClick={() => signIn("admin")}>
            Continue as Admin
          </button>
          <button type="button" onClick={() => signIn("member")}>
            Continue as Member
          </button>
          <button type="button" onClick={() => signIn("viewer")}>
            Continue as Viewer
          </button>
        </div>
      </section>
    </div>
  );
}
