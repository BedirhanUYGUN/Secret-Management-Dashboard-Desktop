import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-panel">
      <h2>Sayfa bulunamadi</h2>
      <Link to="/projects">Projelere don</Link>
    </section>
  );
}
