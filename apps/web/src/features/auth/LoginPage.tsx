import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@core/auth/AuthContext";
import { useState } from "react";
import { requestPasswordReset } from "@core/api/client";
import { Button } from "@core/ui/Button";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/ui/Card";
import { FolderKey, Loader2 } from "lucide-react";

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
      navigate("/", { replace: true });
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
            <FolderKey className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Giriş Yap</CardTitle>
          <CardDescription>API anahtarlarınızı yönetmek için giriş yapın.</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
              {errorMessage}
            </div>
          )}

          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@sirket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-[var(--primary)] hover:underline cursor-pointer"
              onClick={() => setShowResetForm((prev) => !prev)}
            >
              {showResetForm ? "Şifre sıfırlama formunu kapat" : "Şifremi unuttum"}
            </button>

            {showResetForm && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--muted)] p-4">
                <form className="space-y-3" onSubmit={(event) => void handlePasswordReset(event)}>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Şifre sıfırlama e-postası</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="ornek@sirket.com"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full" disabled={loading}>
                    Sıfırlama Bağlantısı Gönder
                  </Button>
                </form>
                {resetMessage && (
                  <p className="mt-2 text-sm text-brand-400">{resetMessage}</p>
                )}
              </div>
            )}

            <p className="text-center text-sm text-[var(--muted-foreground)]">
              Hesabın yok mu?{" "}
              <Link to="/register" className="text-[var(--primary)] hover:underline">
                Kayıt Ol
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
