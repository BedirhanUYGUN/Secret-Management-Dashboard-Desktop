import { useEffect, useState } from "react";
import { fetchAudit, fetchProjects, type ProjectSummary } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { AuditEvent } from "@core/types";
import { Spinner } from "@core/ui/Spinner";

const actionOptions = ["all", "secret_created", "secret_updated", "secret_deleted", "secret_copied", "secret_exported"] as const;

const actionLabels: Record<string, string> = {
  all: "Tum islemler",
  secret_created: "Olusturma",
  secret_updated: "Guncelleme",
  secret_deleted: "Silme",
  secret_copied: "Kopyalama",
  secret_exported: "Disari Aktarim",
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
    if (!user) {
      return;
    }

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
        setErrorMessage(error.message || "Denetim verileri yuklenemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudit();
  }, [actionFilter, fromDate, projectFilter, toDate, user, userEmailFilter]);

  if (!user) {
    return null;
  }

  return (
    <section className="page-panel">
      <h2>Denetim Kaydi</h2>
      <div className="filter-row filter-row-wrap">
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as (typeof actionOptions)[number])}>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {actionLabels[action] ?? action}
            </option>
          ))}
        </select>

        <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="all">Tum projeler</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <input
          placeholder="Kullanici e-postasi"
          value={userEmailFilter}
          onChange={(event) => setUserEmailFilter(event.target.value)}
        />

        <input type="datetime-local" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <input type="datetime-local" value={toDate} onChange={(event) => setToDate(event.target.value)} />
      </div>

      {errorMessage && <p className="inline-error">{errorMessage}</p>}
      {loading && <Spinner text="Denetim kayitlari yukleniyor..." />}
      <div className="audit-list">
        {auditEvents.map((event) => (
          <div key={event.id} className="audit-item">
            <strong>{actionLabels[event.action] ?? event.action}</strong>
            <span>{event.actor}</span>
            <span>{projects.find((project) => project.id === event.projectId)?.name ?? event.projectId}</span>
            <span>{event.secretName}</span>
            <span>{new Date(event.occurredAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
