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
      setErrorMessage("E-posta ve şifre alanları zorunludur.");
      return;
    }

    try {
      await login(email.trim(), password);
      navigate("/projects", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes("401") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
          setErrorMessage("E-posta veya şifre hatalı.");
        } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
          setErrorMessage("Sunucuya bağlanılamıyor. Lütfen tekrar deneyin.");
        } else {
          setErrorMessage(msg || "Giriş başarısız.");
        }
      }
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Giriş Yap</h1>
        <p>API anahtarlarınızı yönetmek için giriş yapın.</p>
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
            Şifre
            <input
              type="password"
              className="login-input"
              placeholder="Şifrenizi girin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
          <p className="auth-switch-text">
            Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
