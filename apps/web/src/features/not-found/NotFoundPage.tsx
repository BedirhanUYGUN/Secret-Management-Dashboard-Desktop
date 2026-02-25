import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-panel">
      <h2>Sayfa bulunamadı</h2>
      <Link to="/projects">Projelere dön</Link>
    </section>
  );
}
