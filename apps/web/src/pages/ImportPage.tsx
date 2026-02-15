export function ImportPage() {
  return (
    <section className="page-panel">
      <h2>TXT Import Wizard</h2>
      <ol>
        <li>Upload or paste TXT content.</li>
        <li>Preview parsed project headings and KEY=value lines.</li>
        <li>Map to project/environment and conflict strategy.</li>
        <li>Confirm import and review summary.</li>
      </ol>
      <div className="import-dropzone">Drop TXT file here (parser wiring next).</div>
    </section>
  );
}
