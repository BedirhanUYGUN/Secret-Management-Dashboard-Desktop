import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@core/auth/AuthContext";
import { useState } from "react";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage("E-posta ve sifre alanlari zorunludur.");
      return;
    }

    try {
      await login(email.trim(), password);
      navigate("/projects", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes("401") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
          setErrorMessage("E-posta veya sifre hatali.");
        } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
          setErrorMessage("Sunucuya baglanilamiyor. Lutfen tekrar deneyin.");
        } else {
          setErrorMessage(msg || "Giris basarisiz.");
        }
      }
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Giris Yap</h1>
        <p>API anahtarlarinizi yonetmek icin giris yapin.</p>
        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="login-label">
            E-posta
            <input
              type="email"
              className="login-input"
              placeholder="ornek@sirket.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </label>
          <label className="login-label">
            Sifre
            <input
              type="password"
              className="login-input"
              placeholder="Sifrenizi girin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Giris yapiliyor..." : "Giris Yap"}
          </button>
          <p className="auth-switch-text">
            Hesabin yok mu? <Link to="/register">Kayit Ol</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
