import { useAppUi } from "../ui/AppUiContext";

export function SettingsPage() {
  const { clipboardSeconds, setClipboardSeconds, showToast } = useAppUi();

  return (
    <section className="page-panel">
      <h2>Guvenlik Tercihleri</h2>
      <div className="settings-grid">
        <label>
          Pano temizleme suresi (saniye)
          <input
            type="number"
            value={clipboardSeconds}
            min={5}
            max={300}
            onChange={(event) => setClipboardSeconds(Number(event.target.value))}
          />
        </label>
        <label>
          Degerleri varsayilan olarak maskele
          <select defaultValue="yes">
            <option value="yes">Evet</option>
            <option value="no">Hayir</option>
          </select>
        </label>
      </div>
      <div className="action-row">
        <button
          type="button"
          onClick={() => {
            showToast("Ayarlar kaydedildi", "success");
          }}
        >
          Tercihleri Kaydet
        </button>
      </div>
    </section>
  );
}
