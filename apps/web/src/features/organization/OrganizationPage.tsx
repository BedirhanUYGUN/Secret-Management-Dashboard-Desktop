import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Key, Plus, RefreshCw, UserMinus, Users, X } from "lucide-react";
import {
  addProjectMember,
  createOrganizationInvite,
  fetchManagedOrganizations,
  fetchOrganizationInvites,
  fetchProjectDetails,
  fetchUsers,
  removeProjectMember,
  revokeOrganizationInvite,
  rotateOrganizationInvite,
  updateProjectMemberRole,
} from "@core/api/client";
import type { Invite, ManagedUser, OrganizationSummary, ProjectDetail, Role } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Badge } from "@core/ui/Badge";
import { Button } from "@core/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";
import { cn } from "@core/ui/cn";

const roleLabels: Record<Role, string> = {
  admin: "Yönetici",
  member: "Üye",
  viewer: "İzleyici",
};

const roleOptions: Role[] = ["admin", "member", "viewer"];

export function OrganizationPage() {
  const { showToast, confirm } = useAppUi();

  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string>("");

  const [invites, setInvites] = useState<Invite[]>([]);
  const [managedProject, setManagedProject] = useState<ProjectDetail | null>(null);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);

  const [expiresInHours, setExpiresInHours] = useState<number>(720);
  const [maxUses, setMaxUses] = useState<number>(0);
  const [latestCode, setLatestCode] = useState<string | null>(null);

  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<Role>("member");
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, Role>>({});

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.projectId === selectedProjectSlug) ?? null,
    [organizations, selectedProjectSlug],
  );

  const availableUsers = useMemo(() => {
    if (!managedProject) return [];
    return allUsers.filter(
      (user) => user.isActive && !managedProject.members.some((m) => m.userId === user.id),
    );
  }, [allUsers, managedProject]);

  const parseErrorMessage = (message: string) => {
    if (message.includes("Forbidden") || message.includes("403")) {
      return "Bu işlem için organizasyonda yönetici olmanız gerekiyor.";
    }
    return message;
  };

  const loadOrganizations = useCallback(async () => {
    try {
      const items = await fetchManagedOrganizations();
      setOrganizations(items);
      if (items.length > 0) {
        setSelectedProjectSlug((prev) => prev || items[0].projectId);
      } else {
        setSelectedProjectSlug("");
      }
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
      setOrganizations([]);
    }
  }, []);

  const loadSelectedOrganizationContext = useCallback(async (projectSlug: string) => {
    if (!projectSlug) {
      setInvites([]);
      setManagedProject(null);
      setAllUsers([]);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const [inviteRows, details, users] = await Promise.all([
        fetchOrganizationInvites(projectSlug),
        fetchProjectDetails(),
        fetchUsers(),
      ]);
      setInvites(inviteRows);
      setAllUsers(users);
      setManagedProject(details.find((p) => p.slug === projectSlug) ?? null);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
      setInvites([]);
      setManagedProject(null);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    void loadSelectedOrganizationContext(selectedProjectSlug);
  }, [loadSelectedOrganizationContext, selectedProjectSlug]);

  useEffect(() => {
    if (!managedProject) {
      setMemberRoleDrafts({});
      return;
    }
    setMemberRoleDrafts(
      Object.fromEntries(managedProject.members.map((m) => [m.userId, m.role])) as Record<string, Role>,
    );
  }, [managedProject]);

  const refreshAll = async () => {
    await loadOrganizations();
    await loadSelectedOrganizationContext(selectedProjectSlug);
  };

  const handleCreateInvite = async () => {
    if (!selectedProjectSlug) return;
    setErrorMessage("");
    try {
      const created = await createOrganizationInvite({ projectId: selectedProjectSlug, expiresInHours, maxUses });
      setLatestCode(created.code);
      showToast("Yeni davet anahtarı oluşturuldu", "success");
      await loadSelectedOrganizationContext(selectedProjectSlug);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleRotateInvite = async () => {
    if (!selectedProjectSlug) return;
    setErrorMessage("");
    try {
      const created = await rotateOrganizationInvite({ projectId: selectedProjectSlug, expiresInHours, maxUses });
      setLatestCode(created.code);
      showToast("Aktif davet anahtarı yenilendi", "success");
      await loadSelectedOrganizationContext(selectedProjectSlug);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedProjectSlug) return;
    const approved = await confirm({
      title: "Daveti İptal Et",
      message: "Bu davet anahtarı pasif edilsin mi?",
      confirmLabel: "Pasif Et",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) return;

    setErrorMessage("");
    try {
      await revokeOrganizationInvite({ projectId: selectedProjectSlug, inviteId });
      showToast("Davet anahtarı pasif edildi", "success");
      await loadSelectedOrganizationContext(selectedProjectSlug);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleAddMember = async () => {
    if (!managedProject || !addMemberUserId) return;
    setErrorMessage("");
    try {
      await addProjectMember({ projectId: managedProject.id, userId: addMemberUserId, role: addMemberRole });
      setAddMemberUserId("");
      showToast("Üye eklendi", "success");
      await refreshAll();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleUpdateMemberRole = async (userId: string) => {
    if (!managedProject) return;
    setErrorMessage("");
    try {
      await updateProjectMemberRole({
        projectId: managedProject.id,
        userId,
        role: memberRoleDrafts[userId] ?? "member",
      });
      showToast("Üye rolü güncellendi", "success");
      await refreshAll();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!managedProject) return;
    const approved = await confirm({
      title: "Üyeyi Çıkar",
      message: "Bu üye organizasyondan çıkarılsın mı?",
      confirmLabel: "Çıkar",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) return;

    setErrorMessage("");
    try {
      await removeProjectMember({ projectId: managedProject.id, userId });
      showToast("Üye çıkarıldı", "success");
      await refreshAll();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(parseErrorMessage(error.message));
    }
  };

  const copyLatestCode = async () => {
    if (!latestCode) return;
    try {
      await navigator.clipboard.writeText(latestCode);
      showToast("Davet anahtarı panoya kopyalandı", "success");
    } catch {
      showToast("Kopyalama başarısız oldu", "error");
    }
  };

  const copyInviteLink = async () => {
    if (!latestCode) return;
    const inviteLink = `${window.location.origin}/register?inviteCode=${encodeURIComponent(latestCode)}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast("Davet bağlantısı panoya kopyalandı", "success");
    } catch {
      showToast("Bağlantı kopyalanamadı", "error");
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: organization list */}
      <div className="w-64 shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <h1 className="text-base font-semibold text-[var(--foreground)]">Organizasyonlarım</h1>
        </div>

        {errorMessage && (
          <div className="px-4 py-2 text-xs text-[var(--destructive)]">{errorMessage}</div>
        )}
        {loading && <div className="px-4 py-3"><Spinner /></div>}

        <div className="flex-1 overflow-y-auto">
          {organizations.map((org) => (
            <button
              key={org.projectId}
              type="button"
              className={cn(
                "w-full text-left px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--accent)] transition-colors",
                org.projectId === selectedProjectSlug && "bg-[var(--accent)] border-l-2 border-l-[var(--primary)]",
              )}
              onClick={() => setSelectedProjectSlug(org.projectId)}
            >
              <div className="font-medium text-sm text-[var(--foreground)] truncate">{org.projectName}</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {org.memberCount} üye
              </div>
            </button>
          ))}
          {organizations.length === 0 && !loading && (
            <p className="px-4 py-6 text-sm text-[var(--muted-foreground)] text-center">
              Yönetebileceğiniz organizasyon bulunmuyor.
            </p>
          )}
        </div>
      </div>

      {/* Right panel: organization detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedOrg ? (
          <div className="p-6 space-y-6">
            {/* Org header */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{selectedOrg.projectName}</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void handleCreateInvite()}>
                  <Plus className="h-3.5 w-3.5" />
                  Anahtar Üret
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleRotateInvite()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Anahtar Yenile
                </Button>
              </div>
            </div>

            {/* Invite settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Davet Anahtarı Ayarları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Geçerlilik (saat)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={8760}
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(Number(e.target.value || 1))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kullanım Limiti (0 = sınırsız)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      value={maxUses}
                      onChange={(e) => setMaxUses(Number(e.target.value || 0))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Latest invite code */}
            {latestCode && (
              <Card className="border-[var(--primary)]/30">
                <CardHeader>
                  <CardTitle className="text-sm">Son Üretilen Davet Anahtarı</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <code className="block text-sm font-mono bg-[var(--muted)] rounded px-3 py-2 break-all">
                    {latestCode}
                  </code>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void copyLatestCode()}>
                      <Copy className="h-3.5 w-3.5" />
                      Kopyala
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void copyInviteLink()}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Davet Linki Kopyala
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
                  Organizasyon Üyeleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!managedProject && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Bu organizasyon için üye yönetimi bilgisi alınamadı.
                  </p>
                )}

                {managedProject && managedProject.members.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                    Henüz üye bulunmuyor.
                  </p>
                )}

                {managedProject?.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--foreground)] truncate">{member.displayName}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{member.email}</div>
                    </div>
                    <Select
                      value={memberRoleDrafts[member.userId] ?? member.role}
                      onChange={(e) => setMemberRoleDrafts((prev) => ({ ...prev, [member.userId]: e.target.value as Role }))}
                      className="w-auto h-8 text-xs"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{roleLabels[role]}</option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleUpdateMemberRole(member.userId)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleRemoveMember(member.userId)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Add member row */}
                {managedProject && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                    <Select
                      value={addMemberUserId}
                      onChange={(e) => setAddMemberUserId(e.target.value)}
                      className="flex-1 min-w-[160px] h-8 text-sm"
                    >
                      <option value="">Kullanıcı seçin...</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName} ({user.email})
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={addMemberRole}
                      onChange={(e) => setAddMemberRole(e.target.value as Role)}
                      className="w-auto h-8 text-sm"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{roleLabels[role]}</option>
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
                )}
              </CardContent>
            </Card>

            {/* Invite list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Mevcut Davet Anahtarları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invites.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)]">Davet anahtarı bulunmuyor.</p>
                )}
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    <Badge variant={invite.isActive ? "success" : "secondary"}>
                      {invite.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Kullanım: {invite.usedCount}/{invite.maxUses === 0 ? "sınırsız" : invite.maxUses}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Bitiş: {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : "Yok"}
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleRevokeInvite(invite.id)}
                      disabled={!invite.isActive}
                      className="ml-auto"
                    >
                      <X className="h-3.5 w-3.5" />
                      Pasif Et
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
            <Users className="h-16 w-16 text-[var(--muted-foreground)]/30 mb-4" />
            <h3 className="text-base font-medium text-[var(--foreground)] mb-1">Organizasyon seçilmedi</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Yönetim ekranını açmak için soldan bir organizasyon seçin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
