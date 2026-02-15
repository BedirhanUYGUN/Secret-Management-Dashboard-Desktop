import { useState } from "react";
import { previewImport } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type ImportPreview = {
  heading: string | null;
  totalPairs: number;
  skipped: number;
  preview: Array<{ key: string; value: string }>;
};

export function ImportPage() {
  const { user } = useAuth();
  const [content, setContent] = useState("[Apollo API]\nSTRIPE_API_KEY=sk_live_xxx\nVERCEL_DEPLOY_HOOK=https://...");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) {
    return null;
  }

  const loadPreview = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const response = await previewImport(user.role, content);
      setPreview(response);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Preview failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-panel">
      <h2>TXT Import Wizard</h2>
      <ol>
        <li>Upload or paste TXT content.</li>
        <li>Preview parsed project headings and KEY=value lines.</li>
        <li>Map to project/environment and conflict strategy.</li>
        <li>Confirm import and review summary.</li>
      </ol>

      <textarea
        className="import-textarea"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={10}
      />
      <div className="action-row">
        <button type="button" onClick={() => void loadPreview()} disabled={loading}>
          {loading ? "Loading..." : "Preview Import"}
        </button>
      </div>

      {errorMessage && <p className="inline-error">{errorMessage}</p>}

      {preview && (
        <div className="import-dropzone">
          <div>
            <p>
              Heading: <strong>{preview.heading ?? "N/A"}</strong>
            </p>
            <p>
              Total pairs: <strong>{preview.totalPairs}</strong>
            </p>
            <p>
              Skipped lines: <strong>{preview.skipped}</strong>
            </p>
            <ul>
              {preview.preview.map((item) => (
                <li key={`${item.key}-${item.value}`}>
                  <code>
                    {item.key}={item.value}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
