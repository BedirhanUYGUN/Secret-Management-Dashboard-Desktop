import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Users, X } from "lucide-react";
import { createUser, fetchUsers, updateUser } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { ManagedUser, Role } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Badge } from "@core/ui/Badge";
import { Button } from "@core/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";

const roleOptions: Role[] = ["admin", "member", "viewer"];

const roleLabels: Record<Role, string> = {
  admin: "Yönetici",
  member: "Üye",
  viewer: "İzleyici",
};

const roleBadgeVariant: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  member: "secondary",
  viewer: "outline",
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
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const startEdit = (u: ManagedUser) => {
    setEditingId(u.id);
    setEditForm({ displayName: u.displayName, role: u.role, password: "" });
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
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const toggleActive = async (u: ManagedUser) => {
    const confirmed = await confirm({
      title: u.isActive ? "Kullanıcıyı Deaktif Et" : "Kullanıcıyı Aktif Et",
      message: u.isActive
        ? `${u.displayName} deaktif edilsin mi?`
        : `${u.displayName} aktif edilsin mi?`,
      confirmLabel: u.isActive ? "Deaktif Et" : "Aktif Et",
      cancelLabel: "Vazgeç",
      variant: u.isActive ? "danger" : "default",
    });
    if (!confirmed) return;

    try {
      setErrorMessage("");
      await updateUser({ userId: u.id, isActive: !u.isActive });
      showToast(u.isActive ? "Kullanıcı deaktif edildi" : "Kullanıcı aktif edildi", "success");
      await loadUsers();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-[var(--muted-foreground)]" />
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Kullanıcı Yönetimi</h1>
        </div>
        <Button
          onClick={() => setShowCreateForm((prev) => !prev)}
          variant={showCreateForm ? "outline" : "default"}
          size="sm"
        >
          {showCreateForm ? (
            <>
              <X className="h-4 w-4" />
              İptal
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Yeni Kullanıcı
            </>
          )}
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3 text-sm text-[var(--muted-foreground)]">
        Yeni kullanıcı onboarding için öncelikli akış organizasyon davet bağlantısıdır. Bu ekrandaki manuel oluşturma seçeneğini sadece istisnai yönetici işlemlerinde kullanın.
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yeni Kullanıcı Oluştur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>E-posta</Label>
                <Input
                  placeholder="ornek@sirket.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ad Soyad</Label>
                <Input
                  placeholder="Ad Soyad"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as Role }))}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Şifre</Label>
                <Input
                  type="password"
                  placeholder="Şifre"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => void handleCreate()}>
                <Plus className="h-4 w-4" />
                Oluştur
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {errorMessage}
        </div>
      )}
      {loading && <Spinner text="Kullanıcılar yükleniyor..." />}

      {/* Users table */}
      {!loading && (
        <Card>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-[var(--border)] text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              <span>Ad Soyad</span>
              <span>E-posta</span>
              <span>Rol</span>
              <span>Durum</span>
              <span>İşlemler</span>
            </div>

            {users.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-[var(--muted-foreground)]/40 mb-4" />
                <p className="text-sm text-[var(--muted-foreground)]">Kullanıcı bulunamadı.</p>
              </div>
            )}

            {users.map((u, index) => (
              <div
                key={u.id}
                className={`px-4 py-3 ${index !== users.length - 1 ? "border-b border-[var(--border)]" : ""}`}
              >
                {editingId === u.id ? (
                  /* Edit row */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Ad Soyad</Label>
                        <Input
                          value={editForm.displayName}
                          onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                          placeholder="Ad Soyad"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Şifre (boş bırak = değişmesin)</Label>
                        <Input
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                          placeholder="Yeni şifre"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Rol</Label>
                        <Select
                          value={editForm.role}
                          onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as Role }))}
                          className="h-8 text-sm"
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>{roleLabels[r]}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void handleUpdate()}>
                          <Check className="h-3.5 w-3.5" />
                          Kaydet
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                          İptal
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View row */
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center">
                    <span className="font-medium text-sm text-[var(--foreground)]">
                      {u.displayName}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)] truncate">
                      {u.email}
                    </span>
                    <Badge variant={roleBadgeVariant[u.role]}>
                      {roleLabels[u.role]}
                    </Badge>
                    <Badge variant={u.isActive ? "success" : "secondary"}>
                      {u.isActive ? "Aktif" : "Deaktif"}
                    </Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant={u.isActive ? "destructive" : "secondary"}
                        onClick={() => void toggleActive(u)}
                      >
                        {u.isActive ? "Deaktif Et" : "Aktif Et"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
