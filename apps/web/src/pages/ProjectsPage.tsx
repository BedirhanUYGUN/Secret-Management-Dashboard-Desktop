import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { projects, secrets } from "../data/mockData";
import { useAuth } from "../auth/AuthContext";
import type { Environment, Secret } from "../types";

const envTabs: Environment[] = ["local", "dev", "prod"];

function getSnippet(secret: Secret, format: "json" | "python" | "node") {
  if (format === "json") {
    return JSON.stringify({ [secret.keyName]: secret.valueMasked }, null, 2);
  }
  if (format === "python") {
    return `${secret.keyName} = \"${secret.valueMasked}\"`;
  }
  return `process.env.${secret.keyName} = \"${secret.valueMasked}\";`;
}

export function ProjectsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("project");
  const [activeEnv, setActiveEnv] = useState<Environment>("dev");
  const [revealed, setRevealed] = useState(false);
  const [snippetFormat, setSnippetFormat] = useState<"json" | "python" | "node">("json");
  const [selectedSecretId, setSelectedSecretId] = useState<string>("");

  if (!user) {
    return null;
  }

  const assignmentSet = new Set(user.assignments.map((item) => item.projectId));
  const assignedProjects = projects.filter((project) => assignmentSet.has(project.id));
  const activeProject =
    assignedProjects.find((project) => project.id === projectFromQuery) ?? assignedProjects[0] ?? null;

  const canAccessProd =
    activeProject === null
      ? false
      : (user.assignments.find((item) => item.projectId === activeProject.id)?.prodAccess ?? false);

  const visibleSecrets = useMemo(() => {
    if (!activeProject) {
      return [];
    }
    return secrets.filter(
      (item) => item.projectId === activeProject.id && item.environment === activeEnv && (activeEnv !== "prod" || canAccessProd),
    );
  }, [activeEnv, activeProject, canAccessProd]);

  const selectedSecret = visibleSecrets.find((item) => item.id === selectedSecretId) ?? visibleSecrets[0] ?? null;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op for clipboard unavailable contexts
    }
  };

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
            <button type="button">Export .env</button>
            <button type="button">Export JSON</button>
          </div>
        </div>

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
