import { useEffect, useState } from "react";
import { commitImport, fetchProjects, previewImport, type ImportCommitResponse, type ImportPreviewResponse, type ProjectSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Environment, SecretType } from "../types";
import { useAppUi } from "../ui/AppUiContext";

const environmentOptions: Environment[] = ["local", "dev", "prod"];
const typeOptions: SecretType[] = ["key", "token", "endpoint"];

export function ImportPage() {
  const { user } = useAuth();
  const { showToast } = useAppUi();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState<Environment>("dev");
  const [provider, setProvider] = useState("Imported");
  const [type, setType] = useState<SecretType>("key");
  const [tags, setTags] = useState("imported");
  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite" | "new_version">("skip");

  const [content, setContent] = useState("[Apollo API]\nSTRIPE_API_KEY=sk_live_xxx\nVERCEL_DEPLOY_HOOK=https://...");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [summary, setSummary] = useState<ImportCommitResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    void fetchProjects(user.role)
      .then((rows) => {
        setProjects(rows);
        setProjectId((current) => current || rows[0]?.id || "");
      })
      .catch((error: Error) => setErrorMessage(error.message));
  }, [user]);

  if (!user) {
    return null;
  }

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setErrorMessage("");
      setSummary(null);
      const response = await previewImport(user.role, content);
      setPreview(response);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Preview failed.");
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const runCommit = async () => {
    if (!projectId) {
      setErrorMessage("Project secimi zorunlu.");
      return;
    }

    try {
      setLoadingCommit(true);
      setErrorMessage("");
      const result = await commitImport({
        role: user.role,
        projectId,
        environment,
        content,
        provider,
        type,
        conflictStrategy,
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      });
      setSummary(result);
      showToast("Import islemi tamamlandi", "success");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Import commit failed.");
      }
    } finally {
      setLoadingCommit(false);
    }
  };

  return (
    <section className="page-panel">
      <h2>TXT Import Wizard</h2>
      <ol>
        <li>Upload or paste TXT content.</li>
        <li>Preview parsed project headings and KEY=value lines.</li>
        <li>Map to project/environment and conflict strategy.</li>
        <li>Commit import and review summary.</li>
      </ol>

      <div className="filter-row filter-row-wrap">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select value={environment} onChange={(event) => setEnvironment(event.target.value as Environment)}>
          {environmentOptions.map((env) => (
            <option key={env} value={env}>
              {env.toUpperCase()}
            </option>
          ))}
        </select>

        <select value={type} onChange={(event) => setType(event.target.value as SecretType)}>
          {typeOptions.map((item) => (
            <option key={item} value={item}>
              {item.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          value={conflictStrategy}
          onChange={(event) => setConflictStrategy(event.target.value as "skip" | "overwrite" | "new_version")}
        >
          <option value="skip">Conflict: Skip</option>
          <option value="overwrite">Conflict: Overwrite</option>
          <option value="new_version">Conflict: New Version</option>
        </select>

        <input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Provider" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tag1, tag2" />
      </div>

      <textarea className="import-textarea" value={content} onChange={(event) => setContent(event.target.value)} rows={10} />

      <div className="action-row">
        <button type="button" onClick={() => void loadPreview()} disabled={loadingPreview}>
          {loadingPreview ? "Loading..." : "Preview Import"}
        </button>
        <button type="button" onClick={() => void runCommit()} disabled={loadingCommit || !preview}>
          {loadingCommit ? "Committing..." : "Commit Import"}
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

      {summary && (
        <div className="import-dropzone">
          <div>
            <p>
              Inserted: <strong>{summary.inserted}</strong>
            </p>
            <p>
              Updated: <strong>{summary.updated}</strong>
            </p>
            <p>
              Skipped: <strong>{summary.skipped}</strong>
            </p>
            <p>
              Total processed: <strong>{summary.total}</strong>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
