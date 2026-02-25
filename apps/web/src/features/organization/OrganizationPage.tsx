import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createOrganizationInvite,
  fetchManagedOrganizations,
  fetchOrganizationInvites,
  revokeOrganizationInvite,
  rotateOrganizationInvite,
} from "@core/api/client";
import type { Invite, OrganizationSummary } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Spinner } from "@core/ui/Spinner";

export function OrganizationPage() {
  const { showToast } = useAppUi();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [expiresInHours, setExpiresInHours] = useState<number>(720);
  const [maxUses, setMaxUses] = useState<number>(0);
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.projectId === selectedProjectId) ?? null,
    [organizations, selectedProjectId],
  );

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const items = await fetchManagedOrganizations();
      setOrganizations(items);
      if (items.length > 0) {
        setSelectedProjectId((prev) => prev || items[0].projectId);
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvites = async (projectId: string) => {
    if (!projectId) {
      setInvites([]);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchOrganizationInvites(projectId);
      setInvites(rows);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    void loadInvites(selectedProjectId);
  }, [selectedProjectId]);

  const handleCreateInvite = async () => {
    if (!selectedProjectId) {
      return;
    }
    setErrorMessage("");
    try {
      const created = await createOrganizationInvite({
        projectId: selectedProjectId,
        expiresInHours,
        maxUses,
      });
      setLatestCode(created.code);
      showToast("Yeni davet key oluşturuldu", "success");
      await loadInvites(selectedProjectId);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const handleRotateInvite = async () => {
    if (!selectedProjectId) {
      return;
    }
    setErrorMessage("");
    try {
      const created = await rotateOrganizationInvite({
        projectId: selectedProjectId,
        expiresInHours,
        maxUses,
      });
      setLatestCode(created.code);
      showToast("Aktif davet key yenilendi", "success");
      await loadInvites(selectedProjectId);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedProjectId) {
      return;
    }
    const confirmed = window.confirm("Bu davet key pasif edilsin mi?");
    if (!confirmed) {
      return;
    }
    setErrorMessage("");
    try {
      await revokeOrganizationInvite({ projectId: selectedProjectId, inviteId });
      showToast("Davet key pasif edildi", "success");
      await loadInvites(selectedProjectId);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  const copyLatestCode = async () => {
    if (!latestCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(latestCode);
      showToast("Davet key panoya kopyalandı", "success");
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
              className={org.projectId === selectedProjectId ? "project-manage-item selected" : "project-manage-item"}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedProjectId(org.projectId)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSelectedProjectId(org.projectId);
                }
              }}
            >
              <div>
                <strong>{org.projectName}</strong>
                <small>{org.projectId} • {org.memberCount} uye</small>
              </div>
            </div>
          ))}
          {organizations.length === 0 && !loading && <p className="inline-muted">Yönetebileceginiz organizasyon bulunmuyor.</p>}
        </div>
      </section>

      <aside className="detail-section">
        {selectedOrg ? (
          <>
            <div className="detail-inline-head">
              <h3>{selectedOrg.projectName}</h3>
              <div className="action-row">
                <button type="button" onClick={() => void handleCreateInvite()}>Key Uret</button>
                <button type="button" onClick={() => void handleRotateInvite()}>Key Yenile</button>
              </div>
            </div>

            <div className="detail-box form-box">
              <strong>Davet Key Ayarlari</strong>
              <div className="filter-row" style={{ marginTop: 8 }}>
                <label>
                  Geçerlilik (saat)
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    value={expiresInHours}
                    onChange={(event) => setExpiresInHours(Number(event.target.value || 1))}
                  />
                </label>
                <label>
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
                <strong>Son uretilen davet key:</strong>
                <code>{latestCode}</code>
                <div className="action-row">
                  <button type="button" onClick={() => void copyLatestCode()}>Kopyala</button>
                </div>
              </div>
            )}

            <div className="detail-box" style={{ marginTop: 12 }}>
              <strong>Mevcut Davet Key'ler</strong>
              {invites.length === 0 && <p className="inline-muted">Davet key bulunmuyor.</p>}
              {invites.map((invite) => (
                <div key={invite.id} className="member-row">
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
          <div className="page-panel">Organizasyon seçerek davet key yönetimini acin.</div>
        )}
      </aside>
    </div>
  );
}
