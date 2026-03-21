import { useEffect, useState } from "react";
import { ClipboardList, Filter } from "lucide-react";
import { fetchAudit, fetchProjects, type ProjectSummary } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { AuditEvent } from "@core/types";
import { Badge } from "@core/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";

const actionOptions = [
  "all",
  "secret_created",
  "secret_updated",
  "secret_deleted",
  "secret_copied",
  "secret_exported",
  "secret_revealed",
  "secret_restored",
  "invite_created",
  "invite_rotated",
  "invite_revoked",
  "member_joined",
  "service_exported",
] as const;

const actionLabels: Record<string, string> = {
  all: "Tüm işlemler",
  secret_created: "Oluşturma",
  secret_updated: "Güncelleme",
  secret_deleted: "Silme",
  secret_copied: "Kopyalama",
  secret_exported: "Dışarı Aktarım",
  secret_revealed: "Görüntüleme",
  secret_restored: "Sürüm Geri Yükleme",
  invite_created: "Davet Oluşturma",
  invite_rotated: "Davet Yenileme",
  invite_revoked: "Davet İptali",
  member_joined: "Üye Katılımı",
  service_exported: "Servis Export",
};

const actionBadgeVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  secret_created: "success",
  secret_updated: "warning",
  secret_deleted: "destructive",
  secret_copied: "secondary",
  secret_exported: "outline",
  secret_revealed: "secondary",
  secret_restored: "warning",
  invite_created: "success",
  invite_rotated: "warning",
  invite_revoked: "destructive",
  member_joined: "success",
  service_exported: "outline",
};

export function AuditPage() {
  const { user } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [actionFilter, setActionFilter] = useState<(typeof actionOptions)[number]>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAudit = async () => {
    if (!user) return;
    setErrorMessage("");
    setLoading(true);
    try {
      const [events, projectRows] = await Promise.all([
        fetchAudit({
          action: actionFilter === "all" ? undefined : actionFilter,
          projectId: projectFilter === "all" ? undefined : projectFilter,
          userEmail: userEmailFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        fetchProjects(),
      ]);
      setAuditEvents(events);
      setProjects(projectRows);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Denetim verileri yüklenemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudit();
  }, [actionFilter, fromDate, projectFilter, toDate, user, userEmailFilter]);

  if (!user) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Denetim Kaydı</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-[var(--muted-foreground)] font-medium">
            <Filter className="h-4 w-4" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>İşlem Türü</Label>
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as (typeof actionOptions)[number])}
              >
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {actionLabels[action] ?? action}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Proje</Label>
              <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="all">Tüm projeler</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kullanıcı E-postası</Label>
              <Input
                placeholder="ornek@sirket.com"
                value={userEmailFilter}
                onChange={(e) => setUserEmailFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Başlangıç Tarihi</Label>
              <Input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş Tarihi</Label>
              <Input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {errorMessage}
        </div>
      )}
      {loading && <Spinner text="Denetim kayıtları yükleniyor..." />}

      {/* Event list */}
      {!loading && (
        <div className="space-y-2">
          {auditEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-12 w-12 text-[var(--muted-foreground)]/40 mb-4" />
              <h3 className="text-base font-medium text-[var(--foreground)] mb-1">
                Kayıt bulunamadı
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Seçili filtrelerle eşleşen denetim kaydı yok.
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                <span>İşlem</span>
                <span>Kullanıcı</span>
                <span>Proje</span>
                <span>Secret</span>
                <span>Tarih</span>
              </div>

              {auditEvents.map((event) => {
                const projectName = projects.find((p) => p.id === event.projectId)?.name ?? event.projectId;
                return (
                  <div
                    key={event.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                  >
                    <div>
                      <Badge
                        variant={actionBadgeVariant[event.action] ?? "outline"}
                      >
                        {actionLabels[event.action] ?? event.action}
                      </Badge>
                    </div>
                    <span className="text-sm text-[var(--foreground)] truncate">
                      {event.actor}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)] truncate">
                      {projectName}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)] truncate font-mono">
                      {event.secretName || "-"}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                      {new Date(event.occurredAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {auditEvents.length > 0 && !loading && (
        <p className="text-xs text-[var(--muted-foreground)] text-right">
          {auditEvents.length} kayıt gösteriliyor
        </p>
      )}
    </div>
  );
}
