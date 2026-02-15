import { auditEvents, projects } from "../data/mockData";

export function AuditPage() {
  return (
    <section className="page-panel">
      <h2>Audit Log</h2>
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
