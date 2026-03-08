import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updatePasswordFromRecovery } from "@core/api/client";

function readRecoveryToken() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("access_token") ?? "";
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const accessToken = useMemo(() => readRecoveryToken(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!accessToken) {
      setErrorMessage("Geçerli bir şifre sıfırlama bağlantısı bulunamadı.");
      return;
    }
    if (password.trim().length < 8) {
      setErrorMessage("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Şifreler eşleşmiyor.");
      return;
    }

    try {
      setLoading(true);
      await updatePasswordFromRecovery({ accessToken, password });
      setSuccessMessage("Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Şifre güncellenemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Şifre Yenile</h1>
        <p>Yeni bir şifre belirleyin ve hesabınıza tekrar giriş yapın.</p>

        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        {successMessage && <div className="auth-info-box">{successMessage}</div>}

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="login-label">
            Yeni Şifre
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </label>
          <label className="login-label">
            Yeni Şifre Tekrar
            <input
              type="password"
              className="login-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </label>
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </button>
          <p className="auth-switch-text">
            <Link to="/login">Giriş ekranına dön</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
