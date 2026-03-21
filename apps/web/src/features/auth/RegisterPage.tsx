import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { registerWithProfile, type RegisterOrganizationMode, type RegisterPurpose } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import { Button } from "@core/ui/Button";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/ui/Card";
import { FolderKey, Loader2 } from "lucide-react";

const purposeOptions: Array<{ label: string; value: RegisterPurpose }> = [
  { label: "Personel", value: "personal" },
  { label: "Organizasyon", value: "organization" },
];

const organizationModeOptions: Array<{ label: string; value: RegisterOrganizationMode }> = [
  { label: "Organizasyon olustur", value: "create" },
  { label: "Key ile organizasyona katil", value: "join" },
];

function mapRegisterErrorMessage(rawMessage: string): string {
  const message = rawMessage.trim();
  const normalized = message.toLowerCase();

  if (normalized.includes("sync the account with supabase") || normalized.includes("application database")) {
    return "Bu e-posta uygulamada zaten kayitli. Giris yapmayi deneyin.";
  }
  if (normalized.includes("already") || normalized.includes("email already registered") || normalized.includes("409")) {
    return "Bu e-posta ile kayit zaten mevcut.";
  }
  if (normalized.includes("invite") || normalized.includes("davet") || normalized.includes("400")) {
    return "Kayit bilgileri gecersiz veya davet key hatali.";
  }
  if (normalized.includes("fetch") || normalized.includes("network") || normalized.includes("failed")) {
    return "Sunucuya baglanilamiyor. Lutfen tekrar deneyin.";
  }
  if (normalized.includes("password must include at least one special character")) {
    return "Sifre en az bir ozel karakter icermelidir.";
  }

  try {
    const parsed = JSON.parse(message) as {
      detail?: string | Array<{ msg?: string }>;
      message?: string;
    };
    const detail = parsed.detail;
    if (typeof detail === "string" && detail.trim()) return mapRegisterErrorMessage(detail);
    if (Array.isArray(detail)) {
      const msg = detail.find((item) => typeof item?.msg === "string" && item.msg.trim())?.msg?.trim();
      if (msg) return mapRegisterErrorMessage(msg);
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) return mapRegisterErrorMessage(parsed.message);
  } catch { /* not JSON */ }

  return "Kayit islemi basarisiz.";
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const inviteFromQuery = searchParams.get("inviteCode")?.trim() ?? "";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [purpose, setPurpose] = useState<RegisterPurpose>(inviteFromQuery ? "organization" : "personal");
  const [organizationMode, setOrganizationMode] = useState<RegisterOrganizationMode>(inviteFromQuery ? "join" : "create");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteFromQuery);
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
        organizationName: purpose === "organization" && organizationMode === "create" ? organizationName.trim() : undefined,
        inviteCode: purpose === "organization" && organizationMode === "join" ? inviteCode.trim() : undefined,
      });

      if (result.inviteCode) {
        setIssuedInviteCode(result.inviteCode);
        return;
      }

      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(mapRegisterErrorMessage(error.message));
      } else {
        setErrorMessage("Kayit islemi basarisiz.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
            <FolderKey className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Kayit Ol</CardTitle>
          <CardDescription>Hesap olusturun ve calisma alanina erisin.</CardDescription>
        </CardHeader>
        <CardContent>
          {inviteFromQuery && !issuedInviteCode && (
            <div className="mb-4 rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-400">
              Davet baglantisi ile geldiniz. Hesabinizi olusturdugunuzda organizasyona otomatik katilim akisi tamamlanacaktir.
            </div>
          )}

          {issuedInviteCode && (
            <div className="space-y-3 rounded-md border border-brand-500/30 bg-brand-500/10 p-4">
              <p className="text-sm font-medium text-brand-400">Organizasyon davet key olusturuldu:</p>
              <code className="block rounded bg-[var(--muted)] px-3 py-2 font-mono text-sm">{issuedInviteCode}</code>
              <p className="text-xs text-[var(--muted-foreground)]">Bu key'i ekibinizle paylasabilirsiniz. Kaydetmeden sayfadan ayrilmayin.</p>
              <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
                Giris ekranina don
              </Button>
            </div>
          )}

          {!issuedInviteCode && (
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              {errorMessage && (
                <div className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Isim</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Soyisim</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email">E-posta</Label>
                <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">Sifre</Label>
                <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} />
              </div>

              <div className="space-y-2">
                <Label>Ne icin kullanacaksiniz?</Label>
                <Select value={purpose} onChange={(e) => setPurpose(e.target.value as RegisterPurpose)} disabled={loading}>
                  {purposeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>

              {purpose === "organization" && (
                <>
                  <div className="space-y-2">
                    <Label>Organizasyon secimi</Label>
                    <Select value={organizationMode} onChange={(e) => setOrganizationMode(e.target.value as RegisterOrganizationMode)} disabled={loading}>
                      {organizationModeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </div>

                  {organizationMode === "create" && (
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organizasyon adi</Label>
                      <Input id="orgName" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} disabled={loading} />
                    </div>
                  )}

                  {organizationMode === "join" && (
                    <div className="space-y-2">
                      <Label htmlFor="inviteCode">Davet key</Label>
                      <Input id="inviteCode" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} disabled={loading} />
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Kayit olusturuluyor..." : "Kayit Ol"}
              </Button>

              <p className="text-center text-sm text-[var(--muted-foreground)]">
                Zaten hesabin var mi?{" "}
                <Link to="/login" className="text-[var(--primary)] hover:underline">Giris Yap</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
