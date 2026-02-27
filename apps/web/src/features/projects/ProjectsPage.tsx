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
} from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, Secret, SecretType } from "@core/types";
import { ExportModal } from "@core/ui/ExportModal";
import { useAppUi } from "@core/ui/AppUiContext";
import { Modal } from "@core/ui/Modal";
import { Spinner } from "@core/ui/Spinner";

const envTabs: Environment[] = ["local", "dev", "prod"];
const typeOptions: SecretType[] = ["key", "token", "endpoint"];

type SortKey = "name" | "provider" | "type" | "environment" | "updatedAt";
type SortDir = "asc" | "desc";
type SecretModalMode = "detail" | "edit";

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
  const { copyWithTimer, showToast, confirm } = useAppUi();
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
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretModalMode, setSecretModalMode] = useState<SecretModalMode>("detail");

  const [editForm, setEditForm] = useState({
    name: "",
    provider: "",
    type: "key" as SecretType,
    keyName: "",
    value: "",
    tags: "",
    notes: "",
  });

  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showPlainValue, setShowPlainValue] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void fetchProjects()
      .then((rows) => setProjects(rows))
      .catch((error: Error) => {
        setErrorMessage(error.message || "Projeler yüklenemedi.");
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
        setErrorMessage(error.message || "Anahtarlar yüklenemedi.");
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
    return visibleSecrets.find((item) => item.id === selectedSecretId) ?? null;
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
    setRevealedValue(null);
    setShowPlainValue(false);
  }, [selectedSecret]);

  const sortedSecrets = useMemo(() => {
    const sorted = [...visibleSecrets].sort((a, b) => {
      if (sortKey === "updatedAt") {
        const result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        return sortDir === "asc" ? result : -result;
      }

      const result = a[sortKey].localeCompare(b[sortKey], "tr");
      return sortDir === "asc" ? result : -result;
    });

    return sorted;
  }, [visibleSecrets, sortDir, sortKey]);

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
        successMessage: `${secret.keyName} panoya kopyalandı`,
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

  const toggleReveal = async () => {
    if (!selectedSecret) {
      return;
    }

    if (showPlainValue) {
      setShowPlainValue(false);
      return;
    }

    setIsRevealing(true);
    try {
      const value = await readSecretValue(selectedSecret.id);
      setRevealedValue(value);
      setShowPlainValue(true);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setIsRevealing(false);
    }
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
      showToast("Anahtar oluşturuldu", "success");
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

      setSecretModalMode("detail");
      showToast("Anahtar güncellendi", "success");
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

    const approved = await confirm({
      title: "Anahtarı Sil",
      message: "Bu anahtar silinsin mi? Bu işlem geri alınamaz.",
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) {
      return;
    }

    try {
      await deleteProjectSecret({ secretId: selectedSecret.id });
      showToast("Anahtar silindi", "success");
      setShowSecretModal(false);
      setSelectedSecretId("");
      updateQuery({ secret: null });
      await reloadSecrets();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const handleRowSelect = (secret: Secret) => {
    if (!activeProject) {
      return;
    }

    setSelectedSecretId(secret.id);
    updateQuery({ project: activeProject.id, env: activeEnv, secret: secret.id });
  };

  const openSecretModal = (secret: Secret, mode: SecretModalMode) => {
    handleRowSelect(secret);
    setSecretModalMode(mode);
    setShowSecretModal(true);
  };

  const closeSecretModal = () => {
    setShowSecretModal(false);
    setSecretModalMode("detail");
    setShowPlainValue(false);
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? <span className="sort-indicator">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  if (!user) {
    return null;
  }

  if (!activeProject) {
    return (
      <div className="page-panel">
        <div className="empty-state">
          <span className="empty-state-icon">📂</span>
          <h3 className="empty-state-title">Atanmış proje bulunmuyor</h3>
          <p className="empty-state-description">Henüz size atanmış bir proje yok. Yöneticinizden proje ataması talep edin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-layout">
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
                  {restricted ? " (kısıtlı)" : ""}
                </button>
              );
            })}
          </div>
          <div className="action-row">
            <button type="button" disabled={user.role === "viewer"} onClick={() => setShowCreateForm(true)}>
              Anahtar Ekle
            </button>
            <button type="button" onClick={() => setShowExportModal(true)} disabled={user.role === "viewer"}>
              Dışarı Aktar
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="detail-box form-box" style={{ animation: "fadeIn 0.3s ease" }}>
            <strong className="section-header">Yeni Anahtar Oluştur</strong>
            <p className="section-subtitle">Projeye yeni bir API anahtarı, token veya endpoint ekleyin.</p>
            <div className="form-grid">
              <div>
                <label className="form-label">Anahtar Adı</label>
                <input
                  placeholder="Örn: Stripe API Key"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Servis Sağlayıcı</label>
                <input
                  placeholder="Örn: AWS, Stripe"
                  value={createForm.provider}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, provider: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Tip</label>
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
              </div>

              <hr className="form-divider" />

              <div>
                <label className="form-label">Ortam Değişken Adı</label>
                <input
                  placeholder="Örn: STRIPE_SECRET_KEY"
                  value={createForm.keyName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, keyName: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Gizli Anahtar Değeri</label>
                <input
                  placeholder="Gizli anahtar değeri"
                  value={createForm.value}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, value: event.target.value }))}
                />
              </div>

              <hr className="form-divider" />

              <div>
                <label className="form-label">Etiketler</label>
                <input
                  placeholder="Etiketler (virgülle ayırın, örn: backend, production)"
                  value={createForm.tags}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tags: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Notlar</label>
                <textarea
                  placeholder="Ek notlar (isteğe bağlı)"
                  rows={3}
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </div>
            <div className="action-row" style={{ marginTop: 10 }}>
              <button type="button" className="btn-primary" onClick={() => void submitCreate()}>
                Oluştur
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)}>
                İptal
              </button>
            </div>
          </div>
        )}

        <div className="filter-row">
          <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
            <option value="all">Tüm sağlayıcılar</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">Tüm etiketler</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as SecretType | "all")}>
            <option value="all">Tüm tipler</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        {loading && <Spinner text="Anahtarlar yükleniyor..." variant="skeleton-table" />}

        <div className="table-head secret-table-head">
          <span className="table-head-sortable" onClick={() => toggleSort("name")}>Ad {sortIndicator("name")}</span>
          <span className="table-head-sortable" onClick={() => toggleSort("provider")}>Sağlayıcı {sortIndicator("provider")}</span>
          <span className="table-head-sortable" onClick={() => toggleSort("type")}>Tip {sortIndicator("type")}</span>
          <span className="table-head-sortable" onClick={() => toggleSort("environment")}>Ortam {sortIndicator("environment")}</span>
          <span>Maskeli Değer</span>
          <span className="table-head-sortable" onClick={() => toggleSort("updatedAt")}>Güncelleme {sortIndicator("updatedAt")}</span>
          <span>Düzenle</span>
          <span>Kopyala</span>
        </div>

        {sortedSecrets.map((secret) => (
          <div
            key={secret.id}
            className={secret.id === selectedSecret?.id ? "table-row secret-table-row selected" : "table-row secret-table-row"}
            role="button"
            tabIndex={0}
            onClick={() => handleRowSelect(secret)}
            onDoubleClick={() => openSecretModal(secret, "detail")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                openSecretModal(secret, "detail");
              }
            }}
          >
            <span>{secret.name}</span>
            <span>{secret.provider}</span>
            <span><span className="type-badge">{secret.type.toUpperCase()}</span></span>
            <span><span className={`env-badge env-badge-${secret.environment}`}>{secret.environment.toUpperCase()}</span></span>
            <code>{secret.valueMasked}</code>
            <span>{new Date(secret.updatedAt).toLocaleString()}</span>
            <button
              type="button"
              className="secret-action-btn secret-action-btn-edit"
              aria-label={`${secret.name} düzenle`}
              onClick={(event) => {
                event.stopPropagation();
                openSecretModal(secret, "edit");
              }}
            >
              <span aria-hidden="true">✎</span>
            </button>
            <button
              type="button"
              className="secret-action-btn secret-action-btn-copy"
              onClick={(event) => {
                event.stopPropagation();
                void copySecret(secret, "value");
              }}
            >
              Kopyala
            </button>
          </div>
        ))}

        {!loading && sortedSecrets.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">🔑</span>
            <h3 className="empty-state-title">Bu ortamda anahtar bulunmuyor</h3>
            <p className="empty-state-description">Yeni bir anahtar ekleyerek başlayabilirsiniz.</p>
          </div>
        )}
      </section>

      <Modal
        open={showSecretModal && selectedSecret !== null}
        onClose={closeSecretModal}
        title={secretModalMode === "edit" ? "Anahtarı Düzenle" : "Anahtar Detayları"}
        className="secret-modal-dialog"
      >
        {selectedSecret && (
          <div className="secret-modal-content">
            {secretModalMode === "detail" ? (
              <>
                <div className="detail-inline-head">
                  <div>
                    <h3>{selectedSecret.name}</h3>
                    <p className="inline-muted" style={{ margin: "4px 0 0" }}>
                      {selectedSecret.provider} • {selectedSecret.type.toUpperCase()} • {selectedSecret.environment.toUpperCase()}
                    </p>
                  </div>
                  {user.role !== "viewer" && (
                    <button type="button" className="btn-primary" onClick={() => setSecretModalMode("edit")}>
                      Düzenle
                    </button>
                  )}
                </div>

                <div className="detail-box">
                  <strong>Değer</strong>
                  <div className="reveal-row">
                    <code>{showPlainValue && revealedValue ? revealedValue : "••••••••••••"}</code>
                    <button type="button" className="reveal-btn" onClick={() => void toggleReveal()}>
                      {isRevealing ? "Yükleniyor..." : showPlainValue ? "Değeri Gizle" : "Değeri Göster"}
                    </button>
                  </div>
                </div>

                <div className="detail-box">
                  <strong className="section-header">Kopyalama Formatı</strong>
                  <p className="section-subtitle">Anahtarı farklı formatlarda panoya kopyalayın.</p>
                  <div className="copy-format-grid">
                    <button type="button" className="copy-format-btn" onClick={() => void copySecret(selectedSecret, "value")}>
                      <span className="copy-format-icon">📋</span>
                      <span className="copy-format-title">Düz Değer</span>
                      <span className="copy-format-sub">Ham değer</span>
                    </button>
                    <button type="button" className="copy-format-btn" onClick={() => void copySecret(selectedSecret, "env")}>
                      <span className="copy-format-icon">⚙️</span>
                      <span className="copy-format-title">ENV</span>
                      <span className="copy-format-sub">KEY=value</span>
                    </button>
                    <button type="button" className="copy-format-btn" onClick={() => void copySecret(selectedSecret, "json")}>
                      <span className="copy-format-icon">{ }</span>
                      <span className="copy-format-title">JSON</span>
                      <span className="copy-format-sub">Nesne formatı</span>
                    </button>
                    <button type="button" className="copy-format-btn" onClick={() => void copySecret(selectedSecret, "python")}>
                      <span className="copy-format-icon">🐍</span>
                      <span className="copy-format-title">Python</span>
                      <span className="copy-format-sub">Değişken atama</span>
                    </button>
                    <button type="button" className="copy-format-btn" onClick={() => void copySecret(selectedSecret, "node")}>
                      <span className="copy-format-icon">🟢</span>
                      <span className="copy-format-title">Node.js</span>
                      <span className="copy-format-sub">process.env</span>
                    </button>
                  </div>

                  <div className="snippet-tabs">
                    <button type="button" onClick={() => setSnippetFormat("json")}>JSON</button>
                    <button type="button" onClick={() => setSnippetFormat("python")}>Python</button>
                    <button type="button" onClick={() => setSnippetFormat("node")}>Node</button>
                  </div>

                  <div className="snippet-preview">
                    <span className="snippet-lang">{snippetFormat}</span>
                    <pre>
                      {snippetFormat === "json" && `{"${selectedSecret.keyName}": "${selectedSecret.valueMasked}"}`}
                      {snippetFormat === "python" && `${selectedSecret.keyName} = "${selectedSecret.valueMasked}"`}
                      {snippetFormat === "node" && `process.env.${selectedSecret.keyName} = "${selectedSecret.valueMasked}";`}
                    </pre>
                  </div>
                </div>

                <div className="detail-box">
                  <strong>Detaylar</strong>
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <span className="metadata-label">Son Güncelleyen</span>
                      <span className="metadata-value">{selectedSecret.updatedByName || "-"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Son Kopyalanma</span>
                      <span className="metadata-value">{selectedSecret.lastCopiedAt ? new Date(selectedSecret.lastCopiedAt).toLocaleString() : "-"}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <strong>Etiketler</strong>
                    <div style={{ marginTop: 6 }}>
                      {selectedSecret.tags.length > 0
                        ? selectedSecret.tags.map((tag) => (
                            <span key={tag} className="tag-badge" style={{ marginRight: 6, marginBottom: 4 }}>{tag}</span>
                          ))
                        : <span style={{ color: "#8ca8d9" }}>-</span>}
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <strong>Notlar</strong>
                    <p>{selectedSecret.notes || "-"}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="detail-box form-box" style={{ marginTop: 0 }}>
                <strong className="section-header">Anahtar Bilgilerini Düzenle</strong>
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div>
                    <label className="form-label">Anahtar Adı</label>
                    <input
                      value={editForm.name}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Örn: Stripe API Key"
                    />
                  </div>
                  <div>
                    <label className="form-label">Servis Sağlayıcı</label>
                    <input
                      value={editForm.provider}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, provider: event.target.value }))}
                      placeholder="Örn: AWS, Stripe"
                    />
                  </div>
                  <div>
                    <label className="form-label">Tip</label>
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
                  </div>

                  <hr className="form-divider" />

                  <div>
                    <label className="form-label">Ortam Değişken Adı</label>
                    <input
                      value={editForm.keyName}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, keyName: event.target.value }))}
                      placeholder="Örn: STRIPE_SECRET_KEY"
                    />
                  </div>
                  <div>
                    <label className="form-label">Yeni Gizli Değer</label>
                    <input
                      value={editForm.value}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, value: event.target.value }))}
                      placeholder="Boş bırakırsanız mevcut değer korunur"
                    />
                  </div>

                  <hr className="form-divider" />

                  <div>
                    <label className="form-label">Etiketler</label>
                    <input
                      value={editForm.tags}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, tags: event.target.value }))}
                      placeholder="Etiketler (virgülle ayırın, örn: backend, production)"
                    />
                  </div>
                  <div>
                    <label className="form-label">Notlar</label>
                    <textarea
                      rows={3}
                      value={editForm.notes}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Ek notlar (isteğe bağlı)"
                    />
                  </div>
                </div>
                <div className="action-row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn-primary" onClick={() => void submitEdit()}>
                    Kaydet
                  </button>
                  <button type="button" onClick={() => setSecretModalMode("detail")}>
                    Vazgeç
                  </button>
                  {user.role === "admin" && (
                    <button type="button" className="btn-danger" onClick={() => void removeSecret()}>
                      Sil
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

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
