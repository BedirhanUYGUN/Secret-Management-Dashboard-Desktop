import { useState } from "react";
import { updatePreferences } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import { useAppUi } from "@core/ui/AppUiContext";

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { clipboardSeconds, setClipboardSeconds, showToast } = useAppUi();

  const [maskValues, setMaskValues] = useState<boolean>(user?.preferences.maskValues ?? true);
  const [localClipboard, setLocalClipboard] = useState(clipboardSeconds);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

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

  return (
    <section className="page-panel">
      <h2>Güvenlik Tercihleri</h2>
      <div className="settings-grid">
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
    </section>
  );
}
