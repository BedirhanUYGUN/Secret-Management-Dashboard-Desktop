import { useAppUi } from "../ui/AppUiContext";

export function SettingsPage() {
  const { clipboardSeconds, setClipboardSeconds, showToast } = useAppUi();

  return (
    <section className="page-panel">
      <h2>Security Preferences</h2>
      <div className="settings-grid">
        <label>
          Clipboard clear timer (seconds)
          <input
            type="number"
            value={clipboardSeconds}
            min={5}
            max={300}
            onChange={(event) => setClipboardSeconds(Number(event.target.value))}
          />
        </label>
        <label>
          Mask values by default
          <select defaultValue="yes">
            <option value="yes">Yes</option>
            <option value="no">No</option>
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
          Save Preferences
        </button>
      </div>
    </section>
  );
}
