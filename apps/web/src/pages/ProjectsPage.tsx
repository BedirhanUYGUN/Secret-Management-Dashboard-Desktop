import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createProjectSecret,
  deleteProjectSecret,
  fetchProjectSecrets,
  fetchProjects,
  revealSecretValue,
  trackCopyEvent,
  type ProjectSummary,
  updateProjectSecret,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Environment, Secret, SecretType } from "../types";
import { useAppUi } from "../ui/AppUiContext";
import { ExportModal } from "../ui/ExportModal";
import { Spinner } from "../ui/Spinner";

const envTabs: Environment[] = ["local", "dev", "prod"];
const typeOptions: SecretType[] = ["key", "token", "endpoint"];

function toEnvironment(value: string | null): Environment | null {
  if (value === "local" || value === "dev" || value === "prod") {
    return value;
  }
  return null;
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function ProjectsPage() {
  const { user } = useAuth();
  const { copyWithTimer, showToast } = useAppUi();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryProject = searchParams.get("project");
  const querySecret = searchParams.get("secret");
  const queryEnv = toEnvironment(searchParams.get("env"));

  const [activeEnv, setActiveEnv] = useState<Environment>(queryEnv ?? "dev");
  const [snippetFormat, setSnippetFormat] = useState<"json" | "python" | "node">("json");
  const [selectedSecretId, setSelectedSecretId] = useState<string>(querySecret ?? "");

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [visibleSecrets, setVisibleSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [providerFilter, setProviderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<SecretType | "all">("all");

  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    provider: "",
    type: "key" as SecretType,
    keyName: "",
    value: "",
    tags: "",
    notes: "",
  });

  const [showExportModal, setShowExportModal] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    provider: "",
    type: "key" as SecretType,
    keyName: "",
    value: "",
    tags: "",
    notes: "",
  });

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void fetchProjects()
      .then((rows) => {
        setProjects(rows);
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || "Projeler yuklenemedi.");
      });
  }, [user]);

  useEffect(() => {
    if (queryEnv) {
      setActiveEnv(queryEnv);
    }
  }, [queryEnv]);

  const activeProject = projects.find((project) => project.id === queryProject) ?? projects[0] ?? null;
  const canAccessProd = activeProject?.prodAccess ?? false;

  useEffect(() => {
    if (activeEnv === "prod" && !canAccessProd) {
      setActiveEnv("dev");
      updateQuery({ env: "dev", secret: null });
    }
  }, [activeEnv, canAccessProd]);

  const reloadSecrets = async () => {
    if (!user || !activeProject) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchProjectSecrets({
        projectId: activeProject.id,
        env: activeEnv,
        provider: providerFilter === "all" ? undefined : providerFilter,
        tag: tagFilter === "all" ? undefined : tagFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setVisibleSecrets(rows);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Anahtarlar yuklenemedi.");
      }
      setVisibleSecrets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadSecrets();
  }, [activeEnv, activeProject, providerFilter, tagFilter, typeFilter, user]);

  useEffect(() => {
    if (!querySecret) {
      return;
    }
    setSelectedSecretId(querySecret);
  }, [querySecret]);

  const selectedSecret = useMemo(() => {
    return visibleSecrets.find((item) => item.id === selectedSecretId) ?? visibleSecrets[0] ?? null;
  }, [selectedSecretId, visibleSecrets]);

  useEffect(() => {
    if (!selectedSecret) {
      return;
    }
    setEditForm({
      name: selectedSecret.name,
      provider: selectedSecret.provider,
      type: selectedSecret.type,
      keyName: selectedSecret.keyName,
      value: "",
      tags: selectedSecret.tags.join(", "),
      notes: selectedSecret.notes,
    });
  }, [selectedSecret]);

  const providers = useMemo(() => Array.from(new Set(visibleSecrets.map((item) => item.provider))), [visibleSecrets]);
  const tags = useMemo(() => Array.from(new Set(visibleSecrets.flatMap((item) => item.tags))), [visibleSecrets]);

  const readSecretValue = async (secretId: string) => {
    const revealed = await revealSecretValue({ secretId });
    return revealed.value;
  };

  const copySecret = async (secret: Secret, mode: "value" | "env" | "json" | "python" | "node") => {
    if (!user) {
      return;
    }

    try {
      const value = await readSecretValue(secret.id);
      let payload = value;

      if (mode === "env") {
        payload = `${secret.keyName}=${value}`;
      }
      if (mode === "json") {
        payload = JSON.stringify({ [secret.keyName]: value }, null, 2);
      }
      if (mode === "python") {
        payload = `${secret.keyName} = "${value}"`;
      }
      if (mode === "node") {
        payload = `process.env.${secret.keyName} = "${value}";`;
      }

      await copyWithTimer({
        value: payload,
        successMessage: `${secret.keyName} panoya kopyalandi`,
        onCopied: async () => {
          await trackCopyEvent({ projectId: secret.projectId, secretId: secret.id });
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const startReveal = async () => {
    if (!selectedSecret) {
      return;
    }

    setIsRevealing(true);
    try {
      const value = await readSecretValue(selectedSecret.id);
      setRevealedValue(value);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setIsRevealing(false);
    }
  };

  const stopReveal = () => {
    setRevealedValue(null);
  };

  const submitCreate = async () => {
    if (!user || !activeProject) {
      return;
    }

    try {
      await createProjectSecret({
        projectId: activeProject.id,
        payload: {
          name: createForm.name,
          provider: createForm.provider,
          type: createForm.type,
          environment: activeEnv,
          keyName: createForm.keyName,
          value: createForm.value,
          tags: parseTags(createForm.tags),
          notes: createForm.notes,
        },
      });
      setShowCreateForm(false);
      setCreateForm({ name: "", provider: "", type: "key", keyName: "", value: "", tags: "", notes: "" });
      showToast("Anahtar olusturuldu", "success");
      await reloadSecrets();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const submitEdit = async () => {
    if (!user || !selectedSecret) {
      return;
    }

    try {
      await updateProjectSecret({
        secretId: selectedSecret.id,
        payload: {
          name: editForm.name,
          provider: editForm.provider,
          type: editForm.type,
          keyName: editForm.keyName,
          value: editForm.value || undefined,
          tags: parseTags(editForm.tags),
          notes: editForm.notes,
        },
      });
      setIsEditing(false);
      showToast("Anahtar guncellendi", "success");
      await reloadSecrets();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const removeSecret = async () => {
    if (!user || !selectedSecret) {
      return;
    }
    const confirmed = window.confirm("Bu anahtar silinsin mi?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteProjectSecret({ secretId: selectedSecret.id });
      showToast("Anahtar silindi", "success");
      await reloadSecrets();
      setSelectedSecretId("");
      updateQuery({ secret: null });
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
    return <div className="page-panel">Atanmis proje bulunmuyor.</div>;
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
                  onClick={() => {
                    setActiveEnv(env);
                    updateQuery({ env, secret: null });
                  }}
                  type="button"
                >
                  {env.toUpperCase()}
                  {restricted ? " (kisitli)" : ""}
                </button>
              );
            })}
          </div>
          <div className="action-row">
            <button type="button" disabled={user.role === "viewer"} onClick={() => setShowCreateForm(true)}>
              Anahtar Ekle
            </button>
            <button type="button" onClick={() => setShowExportModal(true)} disabled={user.role === "viewer"}>
              Disari Aktar
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="detail-box form-box">
            <strong>Yeni Anahtar Olustur</strong>
            <div className="form-grid">
              <input placeholder="Ad" value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} />
              <input
                placeholder="Saglayici"
                value={createForm.provider}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, provider: event.target.value }))}
              />
              <select
                value={createForm.type}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, type: event.target.value as SecretType }))}
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
              </select>
              <input
                placeholder="ANAHTAR_ADI"
                value={createForm.keyName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, keyName: event.target.value }))}
              />
              <input
                placeholder="Gizli Deger"
                value={createForm.value}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, value: event.target.value }))}
              />
              <input
                placeholder="etiket1, etiket2"
                value={createForm.tags}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, tags: event.target.value }))}
              />
              <textarea
                placeholder="Notlar"
                rows={3}
                value={createForm.notes}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
            <div className="action-row">
              <button type="button" onClick={() => void submitCreate()}>
                Olustur
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)}>
                Iptal
              </button>
            </div>
          </div>
        )}

        <div className="filter-row">
          <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
            <option value="all">Tum saglayicilar</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">Tum etiketler</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as SecretType | "all")}>
            <option value="all">Tum tipler</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        {loading && <Spinner text="Anahtarlar yukleniyor..." />}

        <div className="table-head">
          <span>Ad</span>
          <span>Saglayici</span>
          <span>Tip</span>
          <span>Ortam</span>
          <span>Maskeli Deger</span>
          <span>Guncelleme</span>
          <span>Kopyala</span>
        </div>

        {visibleSecrets.map((secret) => (
          <div
            key={secret.id}
            className={secret.id === selectedSecret?.id ? "table-row selected" : "table-row"}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedSecretId(secret.id);
              updateQuery({ project: activeProject.id, env: activeEnv, secret: secret.id });
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
            <span>{new Date(secret.updatedAt).toLocaleString()}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void copySecret(secret, "value");
              }}
            >
              Kopyala
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
              <strong>Deger</strong>
              <div className="reveal-row">
                <code>{revealedValue ?? "••••••••••••"}</code>
                <button
                  type="button"
                  onMouseDown={() => void startReveal()}
                  onMouseUp={stopReveal}
                  onMouseLeave={stopReveal}
                  onTouchStart={() => void startReveal()}
                  onTouchEnd={stopReveal}
                >
                  {isRevealing ? "Yukleniyor..." : "Basili Tut ve Gor"}
                </button>
              </div>
            </div>

            <div className="detail-box">
              <strong>Kopyalama Formati</strong>
              <div className="copy-grid">
                <button type="button" onClick={() => void copySecret(selectedSecret, "value")}>
                  Deger
                </button>
                <button type="button" onClick={() => void copySecret(selectedSecret, "env")}>
                  KEY=value
                </button>
                <button type="button" onClick={() => void copySecret(selectedSecret, "json")}>
                  JSON
                </button>
                <button type="button" onClick={() => void copySecret(selectedSecret, "python")}>
                  Python
                </button>
                <button type="button" onClick={() => void copySecret(selectedSecret, "node")}>
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
              <pre>
                {snippetFormat === "json" && `{"${selectedSecret.keyName}": "${selectedSecret.valueMasked}"}`}
                {snippetFormat === "python" && `${selectedSecret.keyName} = "${selectedSecret.valueMasked}"`}
                {snippetFormat === "node" && `process.env.${selectedSecret.keyName} = "${selectedSecret.valueMasked}";`}
              </pre>
            </div>

            <div className="detail-box">
              <div className="detail-inline-head">
                <strong>Detaylar</strong>
                {user.role !== "viewer" && (
                  <button type="button" onClick={() => setIsEditing((prev) => !prev)}>
                    {isEditing ? "Duzenlemeyi Kapat" : "Duzenle"}
                  </button>
                )}
              </div>
              <strong>Son Guncelleyen</strong>
              <p>{selectedSecret.updatedByName || "-"}</p>
              <strong>Son Kopyalanma</strong>
              <p>{selectedSecret.lastCopiedAt ? new Date(selectedSecret.lastCopiedAt).toLocaleString() : "-"}</p>
              <strong>Etiketler</strong>
              <p>{selectedSecret.tags.join(", ") || "-"}</p>
              <strong>Notlar</strong>
              <p>{selectedSecret.notes || "-"}</p>

              {isEditing && user.role !== "viewer" && (
                <div className="form-grid">
                  <input
                    value={editForm.name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Ad"
                  />
                  <input
                    value={editForm.provider}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, provider: event.target.value }))}
                    placeholder="Saglayici"
                  />
                  <select
                    value={editForm.type}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value as SecretType }))}
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editForm.keyName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, keyName: event.target.value }))}
                    placeholder="ANAHTAR_ADI"
                  />
                  <input
                    value={editForm.value}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, value: event.target.value }))}
                    placeholder="Yeni deger (istege bagli)"
                  />
                  <input
                    value={editForm.tags}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, tags: event.target.value }))}
                    placeholder="etiket1, etiket2"
                  />
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Notlar"
                  />
                  <div className="action-row">
                    <button type="button" onClick={() => void submitEdit()}>
                      Kaydet
                    </button>
                    {user.role === "admin" && (
                      <button type="button" onClick={() => void removeSecret()}>
                        Sil
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="page-panel">Bu ortamda anahtar bulunmuyor.</div>
        )}
      </aside>

      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        projectId={activeProject.id}
        projectName={activeProject.name}
        activeEnv={activeEnv}
        availableTags={tags}
      />
    </div>
  );
}
