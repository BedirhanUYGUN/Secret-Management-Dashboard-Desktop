import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { exportProject, fetchProjectSecrets, fetchProjects } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Environment, Project, Secret } from "../types";

const envTabs: Environment[] = ["local", "dev", "prod"];

function getSnippet(secret: Secret, format: "json" | "python" | "node") {
  if (format === "json") {
    return JSON.stringify({ [secret.keyName]: secret.valueMasked }, null, 2);
  }
  if (format === "python") {
    return `${secret.keyName} = "${secret.valueMasked}"`;
  }
  return `process.env.${secret.keyName} = "${secret.valueMasked}";`;
}

type ProjectSummary = Project & { keyCount: number };

export function ProjectsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("project");
  const [activeEnv, setActiveEnv] = useState<Environment>("dev");
  const [revealed, setRevealed] = useState(false);
  const [snippetFormat, setSnippetFormat] = useState<"json" | "python" | "node">("json");
  const [selectedSecretId, setSelectedSecretId] = useState<string>("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [visibleSecrets, setVisibleSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }
    void fetchProjects(user.role)
      .then((response) => {
        setProjects(response);
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || "Projects could not be loaded.");
      });
  }, [user]);

  const activeProject = projects.find((project) => project.id === projectFromQuery) ?? projects[0] ?? null;

  const canAccessProd =
    activeProject === null
      ? false
      : (user?.assignments.find((item) => item.projectId === activeProject.id)?.prodAccess ?? false);

  useEffect(() => {
    if (!user || !activeProject) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    void fetchProjectSecrets({
      role: user.role,
      projectId: activeProject.id,
      env: activeEnv,
    })
      .then((response) => {
        setVisibleSecrets(response);
      })
      .catch((error: Error) => {
        setVisibleSecrets([]);
        setErrorMessage(error.message || "Secrets could not be loaded.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeEnv, activeProject, user]);

  const selectedSecret = useMemo(
    () => visibleSecrets.find((item) => item.id === selectedSecretId) ?? visibleSecrets[0] ?? null,
    [selectedSecretId, visibleSecrets],
  );

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op for clipboard unavailable contexts
    }
  };

  const runExport = async (format: "env" | "json") => {
    if (!user || !activeProject) {
      return;
    }

    try {
      const payload = await exportProject({
        role: user.role,
        projectId: activeProject.id,
        env: activeEnv,
        format,
      });
      await copy(payload);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  if (!user) {
    return null;
  }

  if (!activeProject) {
    return <div className="page-panel">No assigned projects.</div>;
  }

  return (
    <div className="workspace-grid">
      <section className="table-section">
        <div className="table-toolbar">
          <h2>{activeProject.name}</h2>
          <div className="tab-row">
            {envTabs.map((env) => {
              const restricted = env === "prod" && !canAccessProd;
              return (
                <button
                  key={env}
                  className={env === activeEnv ? "tab active" : "tab"}
                  disabled={restricted}
                  onClick={() => setActiveEnv(env)}
                  type="button"
                >
                  {env.toUpperCase()}
                  {restricted ? " (restricted)" : ""}
                </button>
              );
            })}
          </div>
          <div className="action-row">
            <button type="button" disabled={user.role === "viewer"}>
              Add Secret
            </button>
            <button type="button" onClick={() => void runExport("env")}>
              Export .env
            </button>
            <button type="button" onClick={() => void runExport("json")}>
              Export JSON
            </button>
          </div>
        </div>

        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        {loading && <p className="inline-muted">Loading secrets...</p>}

        <div className="table-head">
          <span>Name</span>
          <span>Provider</span>
          <span>Type</span>
          <span>Environment</span>
          <span>Masked Value</span>
          <span>Updated</span>
          <span>Copy</span>
        </div>

        {visibleSecrets.map((secret) => (
          <div
            key={secret.id}
            className={secret.id === selectedSecret?.id ? "table-row selected" : "table-row"}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedSecretId(secret.id);
              setSearchParams({ project: activeProject.id });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setSelectedSecretId(secret.id);
              }
            }}
          >
            <span>{secret.name}</span>
            <span>{secret.provider}</span>
            <span>{secret.type}</span>
            <span>{secret.environment.toUpperCase()}</span>
            <code>{secret.valueMasked}</code>
            <span>{secret.updatedAt}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void copy(secret.valueMasked);
              }}
            >
              Copy
            </button>
          </div>
        ))}
      </section>

      <aside className="detail-section">
        {selectedSecret ? (
          <>
            <h3>{selectedSecret.name}</h3>
            <p>
              {selectedSecret.provider} • {selectedSecret.type}
            </p>

            <div className="detail-box">
              <strong>Value</strong>
              <div className="reveal-row">
                <code>{revealed ? selectedSecret.valueMasked : "••••••••••••"}</code>
                <button
                  type="button"
                  onMouseDown={() => setRevealed(true)}
                  onMouseUp={() => setRevealed(false)}
                  onMouseLeave={() => setRevealed(false)}
                  onTouchStart={() => setRevealed(true)}
                  onTouchEnd={() => setRevealed(false)}
                >
                  Hold to Reveal
                </button>
              </div>
            </div>

            <div className="detail-box">
              <strong>Copy As</strong>
              <div className="copy-grid">
                <button type="button" onClick={() => void copy(selectedSecret.valueMasked)}>
                  Value
                </button>
                <button type="button" onClick={() => void copy(`${selectedSecret.keyName}=${selectedSecret.valueMasked}`)}>
                  KEY=value
                </button>
                <button type="button" onClick={() => void copy(getSnippet(selectedSecret, "json"))}>
                  JSON
                </button>
                <button type="button" onClick={() => void copy(getSnippet(selectedSecret, "python"))}>
                  Python
                </button>
                <button type="button" onClick={() => void copy(getSnippet(selectedSecret, "node"))}>
                  Node
                </button>
              </div>
              <div className="snippet-tabs">
                <button type="button" onClick={() => setSnippetFormat("json")}>
                  JSON
                </button>
                <button type="button" onClick={() => setSnippetFormat("python")}>
                  Python
                </button>
                <button type="button" onClick={() => setSnippetFormat("node")}>
                  Node
                </button>
              </div>
              <pre>{getSnippet(selectedSecret, snippetFormat)}</pre>
            </div>

            <div className="detail-box">
              <strong>Tags</strong>
              <p>{selectedSecret.tags.join(", ")}</p>
              <strong>Notes</strong>
              <p>{selectedSecret.notes}</p>
            </div>
          </>
        ) : (
          <div className="page-panel">No secrets in this environment.</div>
        )}
      </aside>
    </div>
  );
}
