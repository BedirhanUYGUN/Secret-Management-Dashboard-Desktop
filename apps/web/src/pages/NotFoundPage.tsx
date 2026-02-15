import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-panel">
      <h2>Page not found</h2>
      <Link to="/projects">Go to projects</Link>
    </section>
  );
}
