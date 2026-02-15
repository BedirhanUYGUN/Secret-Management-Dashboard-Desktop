import { useEffect, useState } from "react";
import { fetchAudit, fetchProjects } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { AuditEvent, Project } from "../types";

type ProjectSummary = Project & { keyCount: number };

export function AuditPage() {
  const { user } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    void Promise.all([fetchAudit(user.role), fetchProjects(user.role)])
      .then(([events, projectRows]) => {
        setAuditEvents(events);
        setProjects(projectRows);
      })
      .catch((error: Error) => setErrorMessage(error.message || "Audit data could not be loaded."));
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <section className="page-panel">
      <h2>Audit Log</h2>
      {errorMessage && <p className="inline-error">{errorMessage}</p>}
      <div className="audit-list">
        {auditEvents.map((event) => (
          <div key={event.id} className="audit-item">
            <strong>{event.action}</strong>
            <span>{event.actor}</span>
            <span>{projects.find((project) => project.id === event.projectId)?.name ?? event.projectId}</span>
            <span>{event.secretName}</span>
            <span>{event.occurredAt}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
