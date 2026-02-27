import { useEffect, useState } from "react";
import { createUser, fetchUsers, updateUser } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { ManagedUser, Role } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Spinner } from "@core/ui/Spinner";

const roleOptions: Role[] = ["admin", "member", "viewer"];

const roleLabels: Record<Role, string> = {
  admin: "Yönetici",
  member: "Uye",
  viewer: "Izleyici",
};

export function UsersPage() {
  const { user } = useAuth();
  const { showToast, confirm } = useAppUi();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    displayName: "",
    role: "member" as Role,
    password: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    role: "member" as Role,
    password: "",
  });

  const loadUsers = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchUsers();
      setUsers(rows);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Kullanıcılar yüklenemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadUsers();
  }, [user]);

  const handleCreate = async () => {
    if (!createForm.email.trim() || !createForm.displayName.trim() || !createForm.password.trim()) {
      setErrorMessage("Tüm alanlar zorunludur.");
      return;
    }

    try {
      setErrorMessage("");
      await createUser({
        email: createForm.email.trim(),
        displayName: createForm.displayName.trim(),
        role: createForm.role,
        password: createForm.password,
      });
      setShowCreateForm(false);
      setCreateForm({ email: "", displayName: "", role: "member", password: "" });
      showToast("Kullanıcı oluşturuldu", "success");
      await loadUsers();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const startEdit = (u: ManagedUser) => {
    setEditingId(u.id);
    setEditForm({
      displayName: u.displayName,
      role: u.role,
      password: "",
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    try {
      setErrorMessage("");
      await updateUser({
        userId: editingId,
        displayName: editForm.displayName.trim() || undefined,
        role: editForm.role,
        password: editForm.password.trim() || undefined,
      });
      setEditingId(null);
      showToast("Kullanıcı güncellendi", "success");
      await loadUsers();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const toggleActive = async (u: ManagedUser) => {
    const confirmed = await confirm({
      title: u.isActive ? "Kullaniciyi Deaktif Et" : "Kullaniciyi Aktif Et",
      message: u.isActive
        ? `${u.displayName} deaktif edilsin mi?`
        : `${u.displayName} aktif edilsin mi?`,
      confirmLabel: u.isActive ? "Deaktif Et" : "Aktif Et",
      cancelLabel: "Vazgec",
      variant: u.isActive ? "danger" : "default",
    });
    if (!confirmed) return;

    try {
      setErrorMessage("");
      await updateUser({ userId: u.id, isActive: !u.isActive });
      showToast(u.isActive ? "Kullanıcı deaktif edildi" : "Kullanıcı aktif edildi", "success");
      await loadUsers();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  if (!user) return null;

  return (
    <section className="page-panel">
      <div className="detail-inline-head">
        <h2>Kullanıcı Yönetimi</h2>
        <button type="button" onClick={() => setShowCreateForm((prev) => !prev)}>
          {showCreateForm ? "İptal" : "Yeni Kullanıcı"}
        </button>
      </div>

      {showCreateForm && (
        <div className="detail-box form-box">
          <strong>Yeni Kullanıcı Oluştur</strong>
          <div className="form-grid">
            <input
              placeholder="E-posta"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
            <input
              placeholder="Ad Soyad"
              value={createForm.displayName}
              onChange={(e) => setCreateForm((p) => ({ ...p, displayName: e.target.value }))}
            />
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as Role }))}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
            <input
              type="password"
              placeholder="Şifre"
              value={createForm.password}
              onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div className="action-row">
            <button type="button" onClick={() => void handleCreate()}>
              Oluştur
            </button>
          </div>
        </div>
      )}

      {errorMessage && <p className="inline-error">{errorMessage}</p>}
      {loading && <Spinner text="Kullanıcılar yükleniyor..." />}

      <div className="table-head user-table-head">
        <span>Ad Soyad</span>
        <span>E-posta</span>
        <span>Rol</span>
        <span>Durum</span>
        <span>Islemler</span>
      </div>

      {users.map((u) => (
        <div key={u.id} className="table-row user-table-row">
          {editingId === u.id ? (
            <>
              <input
                value={editForm.displayName}
                onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Ad Soyad"
              />
              <span>{u.email}</span>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as Role }))}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Yeni şifre (boş bırak = değişmesin)"
              />
              <div className="action-row">
                <button type="button" onClick={() => void handleUpdate()}>
                  Kaydet
                </button>
                <button type="button" onClick={() => setEditingId(null)}>
                  İptal
                </button>
              </div>
            </>
          ) : (
            <>
              <span>{u.displayName}</span>
              <span>{u.email}</span>
              <span>{roleLabels[u.role]}</span>
              <span className={u.isActive ? "status-active" : "status-inactive"}>
                {u.isActive ? "Aktif" : "Deaktif"}
              </span>
              <div className="action-row">
                <button type="button" onClick={() => startEdit(u)}>
                  Düzenle
                </button>
                <button type="button" onClick={() => void toggleActive(u)}>
                  {u.isActive ? "Deaktif Et" : "Aktif Et"}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
