import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updatePasswordFromRecovery } from "@core/api/client";
import { Button } from "@core/ui/Button";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/ui/Card";
import { FolderKey, Loader2 } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
            <FolderKey className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Şifre Yenile</CardTitle>
          <CardDescription>Yeni bir şifre belirleyin ve hesabınıza tekrar giriş yapın.</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-400">
              {successMessage}
            </div>
          )}

          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="new-password">Yeni Şifre</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Yeni Şifre Tekrar</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </Button>
            <p className="text-center text-sm text-[var(--muted-foreground)]">
              <Link to="/login" className="text-[var(--primary)] hover:underline">Giriş ekranına dön</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
