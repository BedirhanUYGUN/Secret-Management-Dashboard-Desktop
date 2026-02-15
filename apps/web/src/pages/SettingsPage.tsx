export function SettingsPage() {
  return (
    <section className="page-panel">
      <h2>Security Preferences</h2>
      <div className="settings-grid">
        <label>
          Clipboard clear timer (seconds)
          <input type="number" defaultValue={30} min={5} max={300} />
        </label>
        <label>
          Mask values by default
          <select defaultValue="yes">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
    </section>
  );
}
