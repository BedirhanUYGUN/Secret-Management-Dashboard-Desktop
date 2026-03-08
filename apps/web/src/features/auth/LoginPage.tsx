import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@core/auth/AuthContext";
import { useState } from "react";
import { requestPasswordReset } from "@core/api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

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

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetMessage("");
    setErrorMessage("");

    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setErrorMessage("Şifre sıfırlama için e-posta adresi gereklidir.");
      return;
    }

    try {
      await requestPasswordReset({
        email: targetEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetMessage("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Şifre sıfırlama bağlantısı gönderilemedi.");
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
          <button type="button" className="link-button" onClick={() => setShowResetForm((prev) => !prev)}>
            {showResetForm ? "Şifre sıfırlama formunu kapat" : "Şifremi unuttum"}
          </button>
          {showResetForm && (
            <div className="auth-info-box" style={{ marginTop: 8 }}>
              <form className="login-form" onSubmit={(event) => void handlePasswordReset(event)}>
                <label className="login-label">
                  Şifre sıfırlama e-postası
                  <input
                    type="email"
                    className="login-input"
                    placeholder="ornek@sirket.com"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    disabled={loading}
                  />
                </label>
                <button type="submit" className="login-submit" disabled={loading}>
                  Sıfırlama Bağlantısı Gönder
                </button>
              </form>
              {resetMessage && <p>{resetMessage}</p>}
            </div>
          )}
          <p className="auth-switch-text">
            Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
