import { useEffect, useState } from "react";
import { fetchAudit, fetchProjects, type ProjectSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { AuditEvent } from "../types";

const actionOptions = ["all", "secret_created", "secret_updated", "secret_copied", "secret_exported"] as const;

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

  const loadAudit = async () => {
    if (!user) {
      return;
    }

    setErrorMessage("");
    try {
      const [events, projectRows] = await Promise.all([
        fetchAudit({
          role: user.role,
          action: actionFilter === "all" ? undefined : actionFilter,
          projectId: projectFilter === "all" ? undefined : projectFilter,
          userEmail: userEmailFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        fetchProjects(user.role),
      ]);
      setAuditEvents(events);
      setProjects(projectRows);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Audit data could not be loaded.");
      }
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
      <h2>Audit Log</h2>
      <div className="filter-row filter-row-wrap">
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as (typeof actionOptions)[number])}>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action === "all" ? "All actions" : action}
            </option>
          ))}
        </select>

        <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="all">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <input
          placeholder="User email"
          value={userEmailFilter}
          onChange={(event) => setUserEmailFilter(event.target.value)}
        />

        <input type="datetime-local" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <input type="datetime-local" value={toDate} onChange={(event) => setToDate(event.target.value)} />
      </div>

      {errorMessage && <p className="inline-error">{errorMessage}</p>}
      <div className="audit-list">
        {auditEvents.map((event) => (
          <div key={event.id} className="audit-item">
            <strong>{event.action}</strong>
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
