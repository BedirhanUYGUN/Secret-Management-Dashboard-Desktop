import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithProfile, type RegisterOrganizationMode, type RegisterPurpose } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";

const purposeOptions: Array<{ label: string; value: RegisterPurpose }> = [
  { label: "Personel", value: "personal" },
  { label: "Organizasyon", value: "organization" },
];

const organizationModeOptions: Array<{ label: string; value: RegisterOrganizationMode }> = [
  { label: "Organizasyon olustur", value: "create" },
  { label: "Key ile organizasyona katil", value: "join" },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [purpose, setPurpose] = useState<RegisterPurpose>("personal");
  const [organizationMode, setOrganizationMode] = useState<RegisterOrganizationMode>("create");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [issuedInviteCode, setIssuedInviteCode] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Tum alanlar zorunludur.");
      return;
    }
    if (password.trim().length < 8) {
      setErrorMessage("Sifre en az 8 karakter olmalidir.");
      return;
    }
    if (purpose === "organization" && organizationMode === "create" && !organizationName.trim()) {
      setErrorMessage("Organizasyon adi zorunludur.");
      return;
    }
    if (purpose === "organization" && organizationMode === "join" && !inviteCode.trim()) {
      setErrorMessage("Davet key alani zorunludur.");
      return;
    }

    setLoading(true);
    try {
      const result = await registerWithProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        purpose,
        organizationMode: purpose === "organization" ? organizationMode : "create",
        organizationName:
          purpose === "organization" && organizationMode === "create"
            ? organizationName.trim()
            : undefined,
        inviteCode:
          purpose === "organization" && organizationMode === "join"
            ? inviteCode.trim()
            : undefined,
      });

      if (result.inviteCode) {
        setIssuedInviteCode(result.inviteCode);
        return;
      }

      await login(email.trim(), password);
      navigate("/projects", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes("409") || msg.toLowerCase().includes("already")) {
          setErrorMessage("Bu e-posta ile kayit zaten mevcut.");
        } else if (msg.includes("400") || msg.toLowerCase().includes("invite")) {
          setErrorMessage("Kayit bilgileri gecersiz veya davet key hatali.");
        } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
          setErrorMessage("Sunucuya baglanilamiyor. Lutfen tekrar deneyin.");
        } else {
          setErrorMessage(msg || "Kayit islemi basarisiz.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Kayit Ol</h1>
        <p>Hesap olusturun ve calisma alanina erisin.</p>

        {issuedInviteCode && (
          <div className="auth-info-box">
            <strong>Organizasyon davet key olusturuldu:</strong>
            <code>{issuedInviteCode}</code>
            <p>Bu key'i ekibinizle paylasabilirsiniz. Kaydetmeden sayfadan ayrilmayin.</p>
            <button
              type="button"
              className="login-submit"
              onClick={() => navigate("/login", { replace: true })}
            >
              Giris ekranina don
            </button>
          </div>
        )}

        {!issuedInviteCode && (
          <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
            {errorMessage && <p className="inline-error">{errorMessage}</p>}

            <label className="login-label">
              Isim
              <input
                type="text"
                className="login-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
              />
            </label>

            <label className="login-label">
              Soyisim
              <input
                type="text"
                className="login-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
              />
            </label>

            <label className="login-label">
              E-posta
              <input
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </label>

            <label className="login-label">
              Sifre
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </label>

            <label className="login-label">
              Ne icin kullanacaksiniz?
              <select
                className="login-input"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as RegisterPurpose)}
                disabled={loading}
              >
                {purposeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {purpose === "organization" && (
              <>
                <label className="login-label">
                  Organizasyon secimi
                  <select
                    className="login-input"
                    value={organizationMode}
                    onChange={(e) => setOrganizationMode(e.target.value as RegisterOrganizationMode)}
                    disabled={loading}
                  >
                    {organizationModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {organizationMode === "create" && (
                  <label className="login-label">
                    Organizasyon adi
                    <input
                      type="text"
                      className="login-input"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                )}

                {organizationMode === "join" && (
                  <label className="login-label">
                    Davet key
                    <input
                      type="text"
                      className="login-input"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                )}
              </>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? "Kayit olusturuluyor..." : "Kayit Ol"}
            </button>

            <p className="auth-switch-text">
              Zaten hesabin var mi? <Link to="/login">Giris Yap</Link>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
