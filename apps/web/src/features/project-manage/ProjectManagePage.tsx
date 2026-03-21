import { useEffect, useState } from "react";
import { AlertCircle, Check, FolderOpen, Key, Plus, Save, Trash2, Users, X } from "lucide-react";
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
import { Badge } from "@core/ui/Badge";
import { Button } from "@core/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";
import { cn } from "@core/ui/cn";

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

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "", tags: "" });

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", tags: "" });

  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<Role>("member");
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, Role>>({});

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
        if (prev && p.some((project) => project.id === prev)) return prev;
        return p[0]?.id ?? null;
      });
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
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
        Object.fromEntries(selected.members.map((m) => [m.userId, m.role])) as Record<string, Role>,
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

  const availableUsers = selected
    ? allUsers.filter((u) => u.isActive && !selected.members.some((m) => m.userId === u.id))
    : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: project list */}
      <div className="w-72 shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)]">
          <h1 className="text-base font-semibold text-[var(--foreground)]">Proje Yönetimi</h1>
          <Button
            size="sm"
            variant={showCreate ? "outline" : "default"}
            onClick={() => setShowCreate((prev) => !prev)}
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "İptal" : "Yeni"}
          </Button>
        </div>

        {showCreate && (
          <div className="px-4 py-3 border-b border-[var(--border)] space-y-2 bg-[var(--muted)]/30">
            <Input
              placeholder="Proje Adı"
              value={createForm.name}
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Slug (örn: my-project)"
              value={createForm.slug}
              onChange={(e) => setCreateForm((p) => ({ ...p, slug: e.target.value }))}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Açıklama"
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Etiketler (virgül ile)"
              value={createForm.tags}
              onChange={(e) => setCreateForm((p) => ({ ...p, tags: e.target.value }))}
              className="h-8 text-sm"
            />
            <Button size="sm" className="w-full" onClick={() => void handleCreate()}>
              <Check className="h-3.5 w-3.5" />
              Oluştur
            </Button>
          </div>
        )}

        {errorMessage && (
          <div className="px-4 py-2 text-xs text-[var(--destructive)] flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMessage}
          </div>
        )}

        {loading && <div className="px-4 py-3"><Spinner /></div>}

        <div className="flex-1 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "w-full text-left px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--accent)] transition-colors",
                p.id === selectedId && "bg-[var(--accent)] border-l-2 border-l-[var(--primary)]",
              )}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="font-medium text-sm text-[var(--foreground)] truncate">{p.name}</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                {p.slug} · {p.members.length} üye
                {p.tags.length > 0 && ` · ${p.tags.join(", ")}`}
              </div>
            </button>
          ))}
          {projects.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FolderOpen className="h-10 w-10 text-[var(--muted-foreground)]/40 mb-3" />
              <p className="text-sm font-medium text-[var(--foreground)]">Henüz proje yok</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                "Yeni" butonuna tıklayarak başlayın.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: project detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 space-y-6">
            {/* Project header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{selected.name}</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {selected.slug}
                  {selected.description && ` · ${selected.description}`}
                </p>
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditMode((prev) => !prev)}
                >
                  {editMode ? "İptal" : "Düzenle"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Sil
                </Button>
              </div>
            </div>

            {/* Edit form */}
            {editMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Proje Bilgilerini Düzenle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Proje Adı</Label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Proje Adı"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Açıklama</Label>
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Açıklama"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Etiketler (virgül ile ayırın)</Label>
                      <Input
                        value={editForm.tags}
                        onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))}
                        placeholder="backend, web"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => void handleUpdate()}>
                      <Save className="h-3.5 w-3.5" />
                      Kaydet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Proje Üyeleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.members.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                    Henüz üye yok. Aşağıdan üye ekleyin.
                  </p>
                )}
                {selected.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--foreground)] truncate">{m.displayName}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{m.email}</div>
                    </div>
                    <Select
                      value={memberRoleDrafts[m.userId] ?? m.role}
                      onChange={(e) => setMemberRoleDrafts((prev) => ({ ...prev, [m.userId]: e.target.value as Role }))}
                      className="w-auto h-8 text-xs"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{roleLabels[role]}</option>
                      ))}
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => void handleUpdateMemberRole(m.userId)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void handleRemoveMember(m.userId)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Add member */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                  <Select
                    value={addMemberUserId}
                    onChange={(e) => setAddMemberUserId(e.target.value)}
                    className="flex-1 min-w-[160px] h-8 text-sm"
                  >
                    <option value="">Kullanıcı seç...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
                    ))}
                  </Select>
                  <Select
                    value={addMemberRole}
                    onChange={(e) => setAddMemberRole(e.target.value as Role)}
                    className="w-auto h-8 text-sm"
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{roleLabels[r]}</option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => void handleAddMember()}
                    disabled={!addMemberUserId}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Üye Ekle
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Environment access */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ortam Erişim Yönetimi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Özellikle prod ortamı için kullanıcı bazlı erişim ayarla.
                </p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kullanıcı</Label>
                    <Select
                      value={accessUserId}
                      onChange={(e) => setAccessUserId(e.target.value)}
                      className="h-8 text-sm"
                    >
                      <option value="">Kullanıcı seç...</option>
                      {selected.members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.displayName}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ortam</Label>
                    <Select
                      value={accessEnv}
                      onChange={(e) => setAccessEnv(e.target.value as Environment)}
                      className="h-8 text-sm"
                    >
                      {envOptions.map((env) => (
                        <option key={env} value={env}>{env.toUpperCase()}</option>
                      ))}
                    </Select>
                  </div>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accessRead}
                      onChange={(e) => setAccessRead(e.target.checked)}
                      className="rounded"
                    />
                    Okuma
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accessExport}
                      onChange={(e) => setAccessExport(e.target.checked)}
                      className="rounded"
                    />
                    Dışarı Aktarım
                  </label>
                  <Button
                    size="sm"
                    onClick={() => void handleSetAccess()}
                    disabled={!accessUserId}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Erişimi Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Service tokens */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  CI / Servis Tokenları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Build pipeline veya otomasyon araçları için proje bazlı dışa aktarım tokenı oluşturun.
                </p>

                <div className="flex gap-2">
                  <Input
                    value={serviceTokenName}
                    onChange={(e) => setServiceTokenName(e.target.value)}
                    placeholder="Örn: GitHub Actions Prod Export"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleCreateServiceToken()}
                    disabled={!serviceTokenName.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Token Oluştur
                  </Button>
                </div>

                {latestServiceToken && (
                  <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-4 space-y-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">Yeni servis tokenı</p>
                    <code className="block text-xs font-mono bg-[var(--muted)] rounded px-3 py-2 break-all">
                      {latestServiceToken}
                    </code>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Bu değer sadece bir kez gösterilir. CI/CD sisteminize şimdi ekleyin.
                    </p>
                    <pre className="text-xs font-mono bg-[var(--muted)] rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                      {`curl -H "X-Service-Token: ${latestServiceToken}" "${window.location.origin.includes("localhost") ? "http://localhost:4000" : window.location.origin}/service-access/projects/${selected.slug}/exports?env=dev&format=env"`}
                    </pre>
                  </div>
                )}

                {serviceTokens.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)]">Henüz servis tokenı oluşturulmadı.</p>
                )}

                <div className="space-y-2">
                  {serviceTokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--foreground)]">{token.name}</div>
                        <div className="text-xs text-[var(--muted-foreground)] font-mono">{token.tokenPreview}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          Son kullanım: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "Henüz kullanılmadı"}
                        </div>
                      </div>
                      {token.revokedAt ? (
                        <Badge variant="secondary">İptal Edildi</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleRevokeServiceToken(token.id)}
                        >
                          İptal Et
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
            <FolderOpen className="h-16 w-16 text-[var(--muted-foreground)]/30 mb-4" />
            <h3 className="text-base font-medium text-[var(--foreground)] mb-1">Proje seçilmedi</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Detay görmek için soldan bir proje seçin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
