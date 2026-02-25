import { useEffect, useState } from "react";
import {
  addProjectMember,
  createProject,
  deleteProject,
  fetchProjectDetails,
  fetchUsers,
  removeProjectMember,
  updateEnvironmentAccess,
  updateProject,
} from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, ManagedUser, ProjectDetail, Role } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Spinner } from "@core/ui/Spinner";

const roleOptions: Role[] = ["admin", "member", "viewer"];
const roleLabels: Record<Role, string> = { admin: "Yönetici", member: "Uye", viewer: "Izleyici" };
const envOptions: Environment[] = ["local", "dev", "prod"];

export function ProjectManagePage() {
  const { user } = useAuth();
  const { showToast } = useAppUi();

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

  // Env access form
  const [accessUserId, setAccessUserId] = useState("");
  const [accessEnv, setAccessEnv] = useState<Environment>("prod");
  const [accessRead, setAccessRead] = useState(true);
  const [accessExport, setAccessExport] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [p, u] = await Promise.all([fetchProjectDetails(), fetchUsers()]);
      setProjects(p);
      setAllUsers(u);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
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
    }
  }, [selected]);

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
      if (error instanceof Error) setErrorMessage(error.message);
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
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const confirmed = window.confirm(`"${selected.name}" projesi silinsin mi? Bu işlem geri alinamaz.`);
    if (!confirmed) return;
    try {
      setErrorMessage("");
      await deleteProject(selected.id);
      setSelectedId(null);
      showToast("Proje silindi", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
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
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selected) return;
    const confirmed = window.confirm("Bu üye projeden çıkarılsın mı?");
    if (!confirmed) return;
    try {
      setErrorMessage("");
      await removeProjectMember({ projectId: selected.id, userId });
      showToast("Üye çıkarıldı", "success");
      await loadData();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
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
      if (error instanceof Error) setErrorMessage(error.message);
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
              <input placeholder="Slug (URL dostu)" value={createForm.slug} onChange={(e) => setCreateForm((p) => ({ ...p, slug: e.target.value }))} />
              <input placeholder="Açıklama" value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} />
              <input placeholder="etiket1, etiket2" value={createForm.tags} onChange={(e) => setCreateForm((p) => ({ ...p, tags: e.target.value }))} />
            </div>
            <div className="action-row">
              <button type="button" onClick={() => void handleCreate()}>Oluştur</button>
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
                <small>{p.slug} • {p.members.length} uye • {p.tags.join(", ") || "etiketsiz"}</small>
              </div>
            </div>
          ))}
          {projects.length === 0 && !loading && <p className="inline-muted">Henüz proje yok.</p>}
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
                <button type="button" onClick={() => void handleDelete()}>Sil</button>
              </div>
            </div>
            <p>{selected.slug} • {selected.description || "Açıklama yok"}</p>

            {editMode && (
              <div className="detail-box form-box">
                <strong>Proje Bilgilerini Düzenle</strong>
                <div className="form-grid">
                  <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Proje Adı" />
                  <input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} placeholder="Açıklama" />
                  <input value={editForm.tags} onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))} placeholder="etiket1, etiket2" />
                </div>
                <div className="action-row">
                  <button type="button" onClick={() => void handleUpdate()}>Kaydet</button>
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
                  <span>{roleLabels[m.role]}</span>
                  <button type="button" onClick={() => void handleRemoveMember(m.userId)}>Cikar</button>
                </div>
              ))}
              {selected.members.length === 0 && <p className="inline-muted">Üye bulunmuyor.</p>}

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
              <p className="inline-muted">Özellikle prod ortami için kullanıcı bazli erişim ayarla.</p>
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
          </>
        ) : (
          <div className="page-panel">Detay görmek için soldan bir proje seçin.</div>
        )}
      </aside>
    </div>
  );
}
