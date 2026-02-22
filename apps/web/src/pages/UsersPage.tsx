import { useEffect, useState } from "react";
import { createUser, fetchUsers, updateUser } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { ManagedUser, Role } from "../types";
import { useAppUi } from "../ui/AppUiContext";
import { Spinner } from "../ui/Spinner";

const roleOptions: Role[] = ["admin", "member", "viewer"];

const roleLabels: Record<Role, string> = {
  admin: "Yonetici",
  member: "Uye",
  viewer: "Izleyici",
};

export function UsersPage() {
  const { user } = useAuth();
  const { showToast } = useAppUi();

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
        setErrorMessage(error.message || "Kullanicilar yuklenemedi.");
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
      setErrorMessage("Tum alanlar zorunludur.");
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
      showToast("Kullanici olusturuldu", "success");
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
      showToast("Kullanici guncellendi", "success");
      await loadUsers();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const toggleActive = async (u: ManagedUser) => {
    const confirmed = window.confirm(
      u.isActive
        ? `${u.displayName} deaktif edilsin mi?`
        : `${u.displayName} aktif edilsin mi?`,
    );
    if (!confirmed) return;

    try {
      setErrorMessage("");
      await updateUser({ userId: u.id, isActive: !u.isActive });
      showToast(u.isActive ? "Kullanici deaktif edildi" : "Kullanici aktif edildi", "success");
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
        <h2>Kullanici Yonetimi</h2>
        <button type="button" onClick={() => setShowCreateForm((prev) => !prev)}>
          {showCreateForm ? "Iptal" : "Yeni Kullanici"}
        </button>
      </div>

      {showCreateForm && (
        <div className="detail-box form-box">
          <strong>Yeni Kullanici Olustur</strong>
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
              placeholder="Sifre"
              value={createForm.password}
              onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div className="action-row">
            <button type="button" onClick={() => void handleCreate()}>
              Olustur
            </button>
          </div>
        </div>
      )}

      {errorMessage && <p className="inline-error">{errorMessage}</p>}
      {loading && <Spinner text="Kullanicilar yukleniyor..." />}

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
                placeholder="Yeni sifre (bos birak = degismesin)"
              />
              <div className="action-row">
                <button type="button" onClick={() => void handleUpdate()}>
                  Kaydet
                </button>
                <button type="button" onClick={() => setEditingId(null)}>
                  Iptal
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
                  Duzenle
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
