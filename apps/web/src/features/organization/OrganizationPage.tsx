import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@core/api/client";
import type { Invite, ManagedUser, OrganizationSummary, ProjectDetail, Role } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Spinner } from "@core/ui/Spinner";

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

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.projectId === selectedProjectSlug) ?? null,
    [organizations, selectedProjectSlug],
  );

  const availableUsers = useMemo(() => {
    if (!managedProject) {
      return [];
    }

    return allUsers.filter(
      (user) => user.isActive && !managedProject.members.some((member) => member.userId === user.id),
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
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
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
      setManagedProject(details.find((project) => project.slug === projectSlug) ?? null);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
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

  const refreshAll = async () => {
    await loadOrganizations();
    await loadSelectedOrganizationContext(selectedProjectSlug);
  };

  const handleCreateInvite = async () => {
    if (!selectedProjectSlug) {
      return;
    }

    setErrorMessage("");
    try {
      const created = await createOrganizationInvite({
        projectId: selectedProjectSlug,
        expiresInHours,
        maxUses,
      });
      setLatestCode(created.code);
      showToast("Yeni davet anahtarı oluşturuldu", "success");
      await loadSelectedOrganizationContext(selectedProjectSlug);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
    }
  };

  const handleRotateInvite = async () => {
    if (!selectedProjectSlug) {
      return;
    }

    setErrorMessage("");
    try {
      const created = await rotateOrganizationInvite({
        projectId: selectedProjectSlug,
        expiresInHours,
        maxUses,
      });
      setLatestCode(created.code);
      showToast("Aktif davet anahtarı yenilendi", "success");
      await loadSelectedOrganizationContext(selectedProjectSlug);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedProjectSlug) {
      return;
    }

    const approved = await confirm({
      title: "Daveti İptal Et",
      message: "Bu davet anahtarı pasif edilsin mi?",
      confirmLabel: "Pasif Et",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) {
      return;
    }

    setErrorMessage("");
    try {
      await revokeOrganizationInvite({ projectId: selectedProjectSlug, inviteId });
      showToast("Davet anahtarı pasif edildi", "success");
      await loadSelectedOrganizationContext(selectedProjectSlug);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
    }
  };

  const handleAddMember = async () => {
    if (!managedProject || !addMemberUserId) {
      return;
    }

    setErrorMessage("");
    try {
      await addProjectMember({
        projectId: managedProject.id,
        userId: addMemberUserId,
        role: addMemberRole,
      });
      setAddMemberUserId("");
      showToast("Üye eklendi", "success");
      await refreshAll();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!managedProject) {
      return;
    }

    const approved = await confirm({
      title: "Üyeyi Çıkar",
      message: "Bu üye organizasyondan çıkarılsın mı?",
      confirmLabel: "Çıkar",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) {
      return;
    }

    setErrorMessage("");
    try {
      await removeProjectMember({ projectId: managedProject.id, userId });
      showToast("Üye çıkarıldı", "success");
      await refreshAll();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(parseErrorMessage(error.message));
      }
    }
  };

  const copyLatestCode = async () => {
    if (!latestCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestCode);
      showToast("Davet anahtarı panoya kopyalandı", "success");
    } catch {
      showToast("Kopyalama başarısız oldu", "error");
    }
  };

  return (
    <div className="workspace-grid">
      <section className="table-section">
        <div className="detail-inline-head">
          <h2>Organizasyonlarım</h2>
        </div>

        {errorMessage && <p className="inline-error">{errorMessage}</p>}
        {loading && <Spinner />}

        <div className="project-manage-list">
          {organizations.map((org) => (
            <div
              key={org.projectId}
              className={org.projectId === selectedProjectSlug ? "project-manage-item selected" : "project-manage-item"}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedProjectSlug(org.projectId)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSelectedProjectSlug(org.projectId);
                }
              }}
            >
              <div>
                <strong>{org.projectName}</strong>
                <small>{org.projectId} • {org.memberCount} üye</small>
              </div>
            </div>
          ))}
          {organizations.length === 0 && !loading && (
            <p className="inline-muted">Yönetebileceğiniz organizasyon bulunmuyor.</p>
          )}
        </div>
      </section>

      <aside className="detail-section">
        {selectedOrg ? (
          <>
            <div className="detail-inline-head">
              <h3>{selectedOrg.projectName}</h3>
              <div className="action-row organization-action-row">
                <button type="button" className="btn-primary" onClick={() => void handleCreateInvite()}>
                  Anahtar Üret
                </button>
                <button type="button" onClick={() => void handleRotateInvite()}>
                  Anahtar Yenile
                </button>
              </div>
            </div>

            <div className="detail-box form-box">
              <strong>Davet Anahtarı Ayarları</strong>
              <div className="organization-settings-grid">
                <label className="organization-settings-field">
                  Geçerlilik (saat)
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    value={expiresInHours}
                    onChange={(event) => setExpiresInHours(Number(event.target.value || 1))}
                  />
                </label>
                <label className="organization-settings-field">
                  Kullanım Limiti (0=sınırsız)
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={maxUses}
                    onChange={(event) => setMaxUses(Number(event.target.value || 0))}
                  />
                </label>
              </div>
            </div>

            {latestCode && (
              <div className="auth-info-box" style={{ marginTop: 12 }}>
                <strong>Son üretilen davet anahtarı:</strong>
                <code>{latestCode}</code>
                <div className="action-row">
                  <button type="button" onClick={() => void copyLatestCode()}>Kopyala</button>
                </div>
              </div>
            )}

            <div className="detail-box" style={{ marginTop: 12 }}>
              <strong>Organizasyon Üyeleri</strong>

              {managedProject?.members.map((member) => (
                <div key={member.userId} className="member-row organization-member-row">
                  <span>{member.displayName}</span>
                  <span>{member.email}</span>
                  <span>{roleLabels[member.role]}</span>
                  <button type="button" onClick={() => void handleRemoveMember(member.userId)}>
                    Çıkar
                  </button>
                </div>
              ))}

              {managedProject && managedProject.members.length === 0 && (
                <p className="inline-muted">Henüz üye bulunmuyor.</p>
              )}

              {!managedProject && (
                <p className="inline-muted">Bu organizasyon için üye yönetimi bilgisi alınamadı.</p>
              )}

              {managedProject && (
                <div className="organization-member-add-row">
                  <select value={addMemberUserId} onChange={(event) => setAddMemberUserId(event.target.value)}>
                    <option value="">Kullanıcı seçin...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.displayName} ({user.email})</option>
                    ))}
                  </select>
                  <select value={addMemberRole} onChange={(event) => setAddMemberRole(event.target.value as Role)}>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{roleLabels[role]}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void handleAddMember()} disabled={!addMemberUserId}>
                    Üye Ekle
                  </button>
                </div>
              )}
            </div>

            <div className="detail-box" style={{ marginTop: 12 }}>
              <strong>Mevcut Davet Anahtarları</strong>
              {invites.length === 0 && <p className="inline-muted">Davet anahtarı bulunmuyor.</p>}
              {invites.map((invite) => (
                <div key={invite.id} className="member-row organization-invite-row">
                  <span>{invite.isActive ? "Aktif" : "Pasif"}</span>
                  <span>Kullanım: {invite.usedCount}/{invite.maxUses === 0 ? "sınırsız" : invite.maxUses}</span>
                  <span>Bitiş: {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : "Yok"}</span>
                  <button
                    type="button"
                    onClick={() => void handleRevokeInvite(invite.id)}
                    disabled={!invite.isActive}
                  >
                    Pasif Et
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="page-panel">Organizasyon seçerek yönetim ekranını açın.</div>
        )}
      </aside>
    </div>
  );
}
