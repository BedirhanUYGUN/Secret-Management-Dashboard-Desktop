import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Monitor, Save, Settings2, Shield, User } from "lucide-react";
import { changePassword, fetchSessions, revokeAllSessions, revokeSession, updatePreferences, updateProfile } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { SessionInfo } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Badge } from "@core/ui/Badge";
import { Button } from "@core/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@core/ui/Tabs";

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { clipboardSeconds, setClipboardSeconds, showToast, confirm } = useAppUi();

  const [activeTab, setActiveTab] = useState("profil");

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [maskValues, setMaskValues] = useState<boolean>(user?.preferences.maskValues ?? true);
  const [localClipboard, setLocalClipboard] = useState(clipboardSeconds);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  if (!user) return null;

  useEffect(() => {
    setDisplayName(user.name);
    setMaskValues(user.preferences.maskValues ?? true);
  }, [user]);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const rows = await fetchSessions();
      setSessions(rows);
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message || "Oturumlar yüklenemedi", "error");
      }
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleProfileSave = async () => {
    try {
      setSaving(true);
      await updateProfile({ displayName: displayName.trim() });
      await refreshUser();
      showToast("Profil bilgileri kaydedildi", "success");
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message || "Profil kaydedilemedi", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesSave = async () => {
    try {
      setSaving(true);
      await updatePreferences({
        maskValues,
        clipboardSeconds: localClipboard,
      });
      setClipboardSeconds(localClipboard);
      await refreshUser();
      showToast("Ayarlar kaydedildi", "success");
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message || "Ayarlar kaydedilemedi", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("Tüm alanlar zorunludur.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Yeni şifre en az 8 karakter olmalıdır.");
      return;
    }
    try {
      setSavingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Şifre başarıyla değiştirildi", "success");
    } catch (error) {
      if (error instanceof Error) {
        setPasswordError(error.message || "Şifre değiştirilemedi.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const approved = await confirm({
      title: "Oturumu Sonlandır",
      message: "Bu oturum sonlandırılsın mı? Bu cihaz tekrar giriş yapmak zorunda kalacaktır.",
      confirmLabel: "Sonlandır",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) return;

    try {
      await revokeSession(sessionId);
      showToast("Oturum sonlandırıldı", "success");
      await loadSessions();
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message || "Oturum sonlandırılamadı", "error");
      }
    }
  };

  const handleRevokeAllSessions = async () => {
    const approved = await confirm({
      title: "Tüm Oturumları Sonlandır",
      message: "Tüm aktif oturumlar sonlandırılsın mı? Mevcut cihazınız da tekrar giriş yapmak zorunda kalabilir.",
      confirmLabel: "Hepsini Sonlandır",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) return;

    try {
      await revokeAllSessions();
      showToast("Tüm oturumlar sonlandırıldı", "success");
      await loadSessions();
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message || "Oturumlar sonlandırılamadı", "error");
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Hesap ve Güvenlik</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="profil">
            <User className="h-4 w-4 mr-1.5" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="guvenlik">
            <Shield className="h-4 w-4 mr-1.5" />
            Güvenlik
          </TabsTrigger>
          <TabsTrigger value="tercihler">
            <Settings2 className="h-4 w-4 mr-1.5" />
            Tercihler
          </TabsTrigger>
          <TabsTrigger value="oturumlar">
            <Monitor className="h-4 w-4 mr-1.5" />
            Oturumlar
          </TabsTrigger>
        </TabsList>

        {/* Profil Tab */}
        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Profil Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Görünen Ad</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="opacity-60"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handleProfileSave()}
                  disabled={saving || !displayName.trim()}
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Kaydediliyor..." : "Profili Kaydet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Güvenlik Tab */}
        <TabsContent value="guvenlik">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Şifre Değiştir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Mevcut Şifre</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mevcut şifreniz"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    onClick={() => setShowCurrentPw((prev) => !prev)}
                    aria-label={showCurrentPw ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Yeni Şifre</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 8 karakter"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    onClick={() => setShowNewPw((prev) => !prev)}
                    aria-label={showNewPw ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Şifreyi tekrar girin"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    onClick={() => setShowConfirmPw((prev) => !prev)}
                    aria-label={showConfirmPw ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
                  {passwordError}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handlePasswordChange()}
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  <KeyRound className="h-4 w-4" />
                  {savingPassword ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tercihler Tab */}
        <TabsContent value="tercihler">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4" />
                Güvenlik Tercihleri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clipboardSeconds">Pano temizleme süresi (saniye)</Label>
                  <Input
                    id="clipboardSeconds"
                    type="number"
                    value={localClipboard}
                    min={5}
                    max={300}
                    onChange={(e) => setLocalClipboard(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maskValues">Değerleri varsayılan olarak maskele</Label>
                  <Select
                    id="maskValues"
                    value={maskValues ? "yes" : "no"}
                    onChange={(e) => setMaskValues(e.target.value === "yes")}
                  >
                    <option value="yes">Evet</option>
                    <option value="no">Hayır</option>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handlePreferencesSave()}
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Kaydediliyor..." : "Tercihleri Kaydet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Oturumlar Tab */}
        <TabsContent value="oturumlar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Monitor className="h-4 w-4" />
                  Aktif Oturumlar
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleRevokeAllSessions()}
                  disabled={sessions.length === 0}
                >
                  Tümünü Sonlandır
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSessions && <Spinner text="Oturumlar yükleniyor..." />}
              {!loadingSessions && sessions.length === 0 && (
                <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                  Aktif oturum bulunmuyor.
                </p>
              )}
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] p-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                        <span className="font-medium text-sm truncate">{session.sessionLabel}</span>
                        <Badge variant="success" className="shrink-0">Aktif</Badge>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] pl-6">
                        {session.ipAddress || "IP bilinmiyor"}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] pl-6">
                        Oluşturuldu: {new Date(session.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] pl-6">
                        Son kullanım: {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : "-"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRevokeSession(session.id)}
                      className="shrink-0"
                    >
                      Sonlandır
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
