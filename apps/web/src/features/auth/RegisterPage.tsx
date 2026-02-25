import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithProfile, type RegisterOrganizationMode, type RegisterPurpose } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";

const purposeOptions: Array<{ label: string; value: RegisterPurpose }> = [
  { label: "Personel", value: "personal" },
  { label: "Organizasyon", value: "organization" },
];

const organizationModeOptions: Array<{ label: string; value: RegisterOrganizationMode }> = [
  { label: "Organizasyon oluştur", value: "create" },
  { label: "Key ile organizasyona katıl", value: "join" },
];

function mapRegisterErrorMessage(rawMessage: string): string {
  const message = rawMessage.trim();
  const normalized = message.toLowerCase();

  if (normalized.includes("already") || normalized.includes("email already registered") || normalized.includes("409")) {
    return "Bu e-posta ile kayıt zaten mevcut.";
  }
  if (normalized.includes("invite") || normalized.includes("davet") || normalized.includes("400")) {
    return "Kayıt bilgileri geçersiz veya davet key hatalı.";
  }
  if (normalized.includes("fetch") || normalized.includes("network") || normalized.includes("failed")) {
    return "Sunucuya bağlanılamıyor. Lütfen tekrar deneyin.";
  }
  if (normalized.includes("password must include at least one special character")) {
    return "Şifre en az bir özel karakter içermelidir.";
  }

  try {
    const parsed = JSON.parse(message) as {
      detail?: string | Array<{ msg?: string }>;
      message?: string;
    };

    const detail = parsed.detail;
    if (typeof detail === "string" && detail.trim()) {
      return mapRegisterErrorMessage(detail);
    }

    if (Array.isArray(detail)) {
      const msg = detail.find((item) => typeof item?.msg === "string" && item.msg.trim())?.msg?.trim();
      if (msg) {
        return mapRegisterErrorMessage(msg);
      }
    }

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return mapRegisterErrorMessage(parsed.message);
    }
  } catch {
    // no-op: raw message JSON formatinda degilse dogrudan fallback'e iner
  }

  return "Kayıt işlemi başarısız.";
}

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
      setErrorMessage("Tüm alanlar zorunludur.");
      return;
    }
    if (password.trim().length < 8) {
      setErrorMessage("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (purpose === "organization" && organizationMode === "create" && !organizationName.trim()) {
      setErrorMessage("Organizasyon adı zorunludur.");
      return;
    }
    if (purpose === "organization" && organizationMode === "join" && !inviteCode.trim()) {
      setErrorMessage("Davet key alanı zorunludur.");
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
        setErrorMessage(mapRegisterErrorMessage(error.message));
      } else {
        setErrorMessage("Kayıt işlemi başarısız.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <h1>Kayıt Ol</h1>
        <p>Hesap oluşturun ve çalışma alanına erişin.</p>

        {issuedInviteCode && (
          <div className="auth-info-box">
            <strong>Organizasyon davet key oluşturuldu:</strong>
            <code>{issuedInviteCode}</code>
            <p>Bu key'i ekibinizle paylaşabilirsiniz. Kaydetmeden sayfadan ayrılmayın.</p>
            <button
              type="button"
              className="login-submit"
              onClick={() => navigate("/login", { replace: true })}
            >
              Giriş ekranına dön
            </button>
          </div>
        )}

        {!issuedInviteCode && (
          <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
            {errorMessage && <p className="inline-error">{errorMessage}</p>}

            <label className="login-label">
              İsim
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
              Şifre
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
              Ne için kullanacaksınız?
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
                  Organizasyon seçimi
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
                    Organizasyon adı
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
              {loading ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
            </button>

            <p className="auth-switch-text">
              Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
