import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-panel">
      <div className="empty-state">
        <span className="empty-state-icon">🚫</span>
        <h3 className="empty-state-title">404 - Sayfa bulunamadi</h3>
        <p className="empty-state-description">Aradiginiz sayfa mevcut degil veya tasindi.</p>
        <div className="empty-state-action">
          <Link to="/projects" className="btn-primary" style={{ display: "inline-block", textDecoration: "none", padding: "8px 16px", borderRadius: 10 }}>
            Projelere don
          </Link>
        </div>
      </div>
    </section>
  );
}
