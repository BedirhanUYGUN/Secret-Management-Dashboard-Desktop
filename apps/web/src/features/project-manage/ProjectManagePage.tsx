import { useEffect, useState } from "react";
import {
  addProjectMember,
  createServiceToken,
  createProject,
  deleteProject,
  fetchServiceTokens,
  fetchProjectDetails,
  fetchUsers,
  removeProjectMember,
  revokeServiceToken,
  updateEnvironmentAccess,
  updateProjectMemberRole,
  updateProject,
} from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, ManagedUser, ProjectDetail, Role, ServiceTokenInfo } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Spinner } from "@core/ui/Spinner";

const roleOptions: Role[] = ["admin", "member", "viewer"];
const roleLabels: Record<Role, string> = { admin: "Yönetici", member: "Üye", viewer: "İzleyici" };
const envOptions: Environment[] = ["local", "dev", "prod"];

export function ProjectManagePage() {
  const { user } = useAuth();
  const { showToast, confirm } = useAppUi();

  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "", tags: "" });

  // Edit form
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", tags: "" });

  // Add member form
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<Role>("member");
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, Role>>({});

  // Env access form
  const [accessUserId, setAccessUserId] = useState("");
  const [accessEnv, setAccessEnv] = useState<Environment>("prod");
  const [accessRead, setAccessRead] = useState(true);
  const [accessExport, setAccessExport] = useState(false);
  const [serviceTokens, setServiceTokens] = useState<ServiceTokenInfo[]>([]);
  const [serviceTokenName, setServiceTokenName] = useState("");
  const [latestServiceToken, setLatestServiceToken] = useState<string | null>(null);

  const parseErrorMessage = (message: string) => {
    if (message.includes("Forbidden") || message.includes("403")) {
      return "Bu sayfayı kullanmak için en az bir projede yönetici olmanız gerekiyor.";
    }
    return message;
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const p = await fetchProjectDetails();
      const u = await fetchUsers();
      setProjects(p);
      setAllUsers(u);
      setSelectedId((prev) => {
        if (prev && p.some((project) => project.id === prev)) {
          return prev;
        }
        return p[0]?.id ?? null;
      });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
      setProjects([]);
      setAllUsers([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditForm({ name: selected.name, description: selected.description, tags: selected.tags.join(", ") });
      setMemberRoleDrafts(
        Object.fromEntries(selected.members.map((member) => [member.userId, member.role])) as Record<string, Role>,
      );
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setServiceTokens([]);
      return;
    }

    void fetchServiceTokens(selected.id)
      .then((rows) => setServiceTokens(rows))
      .catch((error: Error) => setErrorMessage(parseErrorMessage(error.message)));
  }, [selectedId]);

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      setErrorMessage("Proje adı ve slug zorunludur.");
      return;
    }
    try {
      setErrorMessage("");
      await createProject({
        name: createForm.name.trim(),
        slug: createForm.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        description: createForm.description.trim(),
        tags: createForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setShowCreate(false);
      setCreateForm({ name: "", slug: "", description: "", tags: "" });
      showToast("Proje oluşturuldu", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    try {
      setErrorMessage("");
      await updateProject({
        projectId: selected.id,
        name: editForm.name.trim() || undefined,
        description: editForm.description.trim(),
        tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setEditMode(false);
      showToast("Proje güncellendi", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const confirmed = await confirm({
      title: "Projeyi Sil",
      message: `"${selected.name}" projesi silinsin mi? Bu işlem geri alınamaz.`,
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setErrorMessage("");
      await deleteProject(selected.id);
      setSelectedId(null);
      showToast("Proje silindi", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleAddMember = async () => {
    if (!selected || !addMemberUserId) return;
    try {
      setErrorMessage("");
      await addProjectMember({ projectId: selected.id, userId: addMemberUserId, role: addMemberRole });
      setAddMemberUserId("");
      showToast("Üye eklendi", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selected) return;
    const confirmed = await confirm({
      title: "Üyeyi Çıkar",
      message: "Bu üye projeden çıkarılsın mı?",
      confirmLabel: "Çıkar",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setErrorMessage("");
      await removeProjectMember({ projectId: selected.id, userId });
      showToast("Üye çıkarıldı", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleUpdateMemberRole = async (userId: string) => {
    if (!selected) return;
    try {
      setErrorMessage("");
      await updateProjectMemberRole({
        projectId: selected.id,
        userId,
        role: memberRoleDrafts[userId] ?? "member",
      });
      showToast("Üye rolü güncellendi", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleSetAccess = async () => {
    if (!selected || !accessUserId) return;
    try {
      setErrorMessage("");
      await updateEnvironmentAccess({
        projectId: selected.id,
        userId: accessUserId,
        environment: accessEnv,
        canRead: accessRead,
        canExport: accessExport,
      });
      showToast("Ortam erişimi güncellendi", "success");
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleCreateServiceToken = async () => {
    if (!selected || !serviceTokenName.trim()) return;
    try {
      setErrorMessage("");
      const created = await createServiceToken({ projectId: selected.id, name: serviceTokenName.trim() });
      setLatestServiceToken(created.token);
      setServiceTokenName("");
      showToast("Servis token oluşturuldu", "success");
      setServiceTokens(await fetchServiceTokens(selected.id));
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleRevokeServiceToken = async (tokenId: string) => {
    if (!selected) return;
    const confirmed = await confirm({
      title: "Servis Tokenını İptal Et",
      message: "Bu token artık CI/CD veya script erişimi için kullanılamayacak.",
      confirmLabel: "İptal Et",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await revokeServiceToken({ projectId: selected.id, tokenId });
      showToast("Servis tokenı iptal edildi", "success");
      setServiceTokens(await fetchServiceTokens(selected.id));
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  if (!user) return null;

  // Members who are not yet in the project (for add dropdown)
  const availableUsers = selected
    ? allUsers.filter((u) => u.isActive && !selected.members.some((m) => m.userId === u.id))
    : [];

  return (
    <div className="workspace-grid">
      {/* Left: project list */}
      <section className="table-section">
        <div className="detail-inline-head">
          <h2>Proje Yönetimi</h2>
          <button type="button" onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? "İptal" : "Yeni Proje"}
          </button>
        </div>

        {showCreate && (
          <div className="detail-box form-box">
            <strong>Yeni Proje Oluştur</strong>
            <div className="form-grid">
              <input placeholder="Proje Adı" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
              <input placeholder="Slug (URL dostu, örn: my-project)" value={createForm.slug} onChange={(e) => setCreateForm((p) => ({ ...p, slug: e.target.value }))} />
              <input placeholder="Açıklama" value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} />
              <input placeholder="Etiketler (virgül ile ayırın, örn: backend, web)" value={createForm.tags} onChange={(e) => setCreateForm((p) => ({ ...p, tags: e.target.value }))} />
            </div>
            <div className="action-row">
              <button type="button" className="btn-primary" onClick={() => void handleCreate()}>Oluştur</button>
            </div>
          </div>
        )}

        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        {loading && <Spinner />}

        <div className="project-manage-list">
          {projects.map((p) => (
            <div
              key={p.id}
              className={p.id === selectedId ? "project-manage-item selected" : "project-manage-item"}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(p.id); }}
            >
              <div>
                <strong>{p.name}</strong>
                <small>{p.slug} • {p.members.length} üye • {p.tags.join(", ") || "etiketsiz"}</small>
              </div>
            </div>
          ))}
          {projects.length === 0 && !loading && (
            <div className="empty-state">
              <span className="empty-state-icon">📂</span>
              <h3 className="empty-state-title">Henüz proje yok</h3>
              <p className="empty-state-description">İlk projenizi oluşturmak için "Yeni Proje" butonuna tıklayın.</p>
            </div>
          )}
        </div>
      </section>

      {/* Right: project detail */}
      <aside className="detail-section">
        {selected ? (
          <>
            <div className="detail-inline-head">
              <h3>{selected.name}</h3>
              <div className="action-row">
                <button type="button" onClick={() => setEditMode((prev) => !prev)}>
                  {editMode ? "İptal" : "Düzenle"}
                </button>
                <button type="button" className="btn-danger" onClick={() => void handleDelete()}>Sil</button>
              </div>
            </div>
            <p>{selected.slug} • {selected.description || "Açıklama yok"}</p>

            {editMode && (
              <div className="detail-box form-box">
                <strong>Proje Bilgilerini Düzenle</strong>
                <div className="form-grid">
                  <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Proje Adı" />
                  <input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} placeholder="Açıklama" />
                  <input value={editForm.tags} onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Etiketler (virgül ile ayırın, örn: backend, web)" />
                </div>
                <div className="action-row">
                  <button type="button" className="btn-primary" onClick={() => void handleUpdate()}>Kaydet</button>
                </div>
              </div>
            )}

            {/* Members */}
            <div className="detail-box">
              <strong>Proje Üyeleri</strong>
              {selected.members.map((m) => (
                <div key={m.userId} className="member-row">
                  <span>{m.displayName}</span>
                  <span>{m.email}</span>
                  <select
                    value={memberRoleDrafts[m.userId] ?? m.role}
                    onChange={(event) => setMemberRoleDrafts((prev) => ({ ...prev, [m.userId]: event.target.value as Role }))}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{roleLabels[role]}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void handleUpdateMemberRole(m.userId)}>Rolü Kaydet</button>
                  <button type="button" onClick={() => void handleRemoveMember(m.userId)}>Çıkar</button>
                </div>
              ))}
              {selected.members.length === 0 && (
                <div className="empty-state" style={{ padding: "20px 10px" }}>
                  <span className="empty-state-icon">👥</span>
                  <h3 className="empty-state-title">Üye bulunmuyor</h3>
                  <p className="empty-state-description">Aşağıdaki formdan üye ekleyebilirsiniz.</p>
                </div>
              )}

              <div className="filter-row" style={{ marginTop: 10 }}>
                <select value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)}>
                  <option value="">Kullanıcı seç...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
                  ))}
                </select>
                <select value={addMemberRole} onChange={(e) => setAddMemberRole(e.target.value as Role)}>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
                <button type="button" onClick={() => void handleAddMember()} disabled={!addMemberUserId}>
                  Üye Ekle
                </button>
              </div>
            </div>

            {/* Environment access */}
            <div className="detail-box">
              <strong>Ortam Erişim Yönetimi</strong>
              <p className="inline-muted">Özellikle prod ortamı için kullanıcı bazlı erişim ayarla.</p>
              <div className="filter-row" style={{ marginTop: 8 }}>
                <select value={accessUserId} onChange={(e) => setAccessUserId(e.target.value)}>
                  <option value="">Kullanıcı seç...</option>
                  {selected.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.displayName}</option>
                  ))}
                </select>
                <select value={accessEnv} onChange={(e) => setAccessEnv(e.target.value as Environment)}>
                  {envOptions.map((env) => (
                    <option key={env} value={env}>{env.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="filter-row" style={{ marginTop: 6 }}>
                <label>
                  <input type="checkbox" checked={accessRead} onChange={(e) => setAccessRead(e.target.checked)} /> Okuma
                </label>
                <label>
                  <input type="checkbox" checked={accessExport} onChange={(e) => setAccessExport(e.target.checked)} /> Dışarı Aktarım
                </label>
                <button type="button" onClick={() => void handleSetAccess()} disabled={!accessUserId}>
                  Erişimi Kaydet
                </button>
              </div>
            </div>

            <div className="detail-box">
              <strong>CI / Servis Tokenları</strong>
              <p className="inline-muted">Build pipeline veya otomasyon araçları için proje bazlı dışa aktarım tokenı oluşturun.</p>
              <div className="filter-row" style={{ marginTop: 8 }}>
                <input
                  value={serviceTokenName}
                  onChange={(event) => setServiceTokenName(event.target.value)}
                  placeholder="Örn: GitHub Actions Prod Export"
                />
                <button type="button" onClick={() => void handleCreateServiceToken()} disabled={!serviceTokenName.trim()}>
                  Token Oluştur
                </button>
              </div>

              {latestServiceToken && (
                <div className="auth-info-box" style={{ marginTop: 10 }}>
                  <strong>Yeni servis tokenı</strong>
                  <code>{latestServiceToken}</code>
                  <p>Bu değer sadece bir kez gösterilir. CI/CD sisteminize şimdi ekleyin.</p>
                  <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{`curl -H "X-Service-Token: ${latestServiceToken}" "${window.location.origin.includes("localhost") ? "http://localhost:4000" : window.location.origin}/service-access/projects/${selected.slug}/exports?env=dev&format=env"`}</pre>
                </div>
              )}

              {serviceTokens.map((token) => (
                <div key={token.id} className="member-row">
                  <div>
                    <strong>{token.name}</strong>
                    <div className="inline-muted">{token.tokenPreview}</div>
                    <div className="inline-muted">Son kullanım: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "Henüz kullanılmadı"}</div>
                  </div>
                  <button type="button" onClick={() => void handleRevokeServiceToken(token.id)} disabled={Boolean(token.revokedAt)}>
                    {token.revokedAt ? "İptal Edildi" : "İptal Et"}
                  </button>
                </div>
              ))}

              {serviceTokens.length === 0 && <p className="inline-muted">Henüz servis tokenı oluşturulmadı.</p>}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">👈</span>
            <h3 className="empty-state-title">Proje seçilmedi</h3>
            <p className="empty-state-description">Detay görmek için soldan bir proje seçin.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
