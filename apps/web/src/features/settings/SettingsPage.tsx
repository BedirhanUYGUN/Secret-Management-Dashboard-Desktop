import { useEffect, useState } from "react";
import { fetchSessions, revokeAllSessions, revokeSession, updatePreferences, updateProfile } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { SessionInfo } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { clipboardSeconds, setClipboardSeconds, showToast, confirm } = useAppUi();

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [maskValues, setMaskValues] = useState<boolean>(user?.preferences.maskValues ?? true);
  const [localClipboard, setLocalClipboard] = useState(clipboardSeconds);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

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

  const handleSave = async () => {
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

  const handleRevokeSession = async (sessionId: string) => {
    const approved = await confirm({
      title: "Oturumu Sonlandır",
      message: "Bu oturum sonlandırılsın mı? Bu cihaz tekrar giriş yapmak zorunda kalacaktır.",
      confirmLabel: "Sonlandır",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) {
      return;
    }

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
    if (!approved) {
      return;
    }

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
    <section className="page-panel">
      <h2>Hesap ve Güvenlik</h2>

      <div className="detail-box form-box">
        <strong>Profil</strong>
        <div className="settings-grid" style={{ marginTop: 12 }}>
          <label>
            Görünen Ad
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            E-posta
            <input value={user.email} disabled />
          </label>
        </div>
        <div className="action-row">
          <button type="button" onClick={() => void handleProfileSave()} disabled={saving || !displayName.trim()}>
            {saving ? "Kaydediliyor..." : "Profili Kaydet"}
          </button>
        </div>
      </div>

      <div className="detail-box form-box" style={{ marginTop: 12 }}>
        <strong>Güvenlik Tercihleri</strong>
        <div className="settings-grid" style={{ marginTop: 12 }}>
          <label>
            Pano temizleme süresi (saniye)
            <input
              type="number"
              value={localClipboard}
              min={5}
              max={300}
              onChange={(event) => setLocalClipboard(Number(event.target.value))}
            />
          </label>
          <label>
            Değerleri varsayılan olarak maskele
            <select value={maskValues ? "yes" : "no"} onChange={(event) => setMaskValues(event.target.value === "yes")}>
              <option value="yes">Evet</option>
              <option value="no">Hayır</option>
            </select>
          </label>
        </div>
        <div className="action-row">
          <button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Kaydediliyor..." : "Tercihleri Kaydet"}
          </button>
        </div>
      </div>

      <div className="detail-box" style={{ marginTop: 12 }}>
        <div className="detail-inline-head">
          <strong>Aktif Oturumlar</strong>
          <button type="button" className="btn-danger" onClick={() => void handleRevokeAllSessions()}>
            Tümünü Sonlandır
          </button>
        </div>

        {loadingSessions && <p className="inline-muted">Oturumlar yükleniyor...</p>}
        {!loadingSessions && sessions.length === 0 && <p className="inline-muted">Aktif oturum bulunmuyor.</p>}

        {sessions.map((session) => (
          <div key={session.id} className="member-row" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{session.sessionLabel}</strong>
              <div className="inline-muted">{session.ipAddress || "IP bilinmiyor"}</div>
              <div className="inline-muted">Oluşturuldu: {new Date(session.createdAt).toLocaleString()}</div>
              <div className="inline-muted">Son kullanım: {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : "-"}</div>
            </div>
            <button type="button" onClick={() => void handleRevokeSession(session.id)}>
              Sonlandır
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
