import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchProjects, type ProjectSummary } from "../api/client";

export function MainLayout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [assignedProjects, setAssignedProjects] = useState<ProjectSummary[]>([]);
  const [projectQuery, setProjectQuery] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    void fetchProjects()
      .then(setAssignedProjects)
      .catch(() => setAssignedProjects([]));
  }, [user]);

  if (!user) {
    return null;
  }

  const filteredProjects = assignedProjects.filter((project) =>
    project.name.toLowerCase().includes(projectQuery.trim().toLowerCase()),
  );

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-title">Anahtar Yoneticisi</div>
        <nav className="main-nav">
          <NavLink to="/projects" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Projeler
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Arama
          </NavLink>
          {user.role === "admin" && (
            <>
              <NavLink to="/users" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Kullanicilar
              </NavLink>
              <NavLink to="/project-manage" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Proje Yonetimi
              </NavLink>
              <NavLink to="/import" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Iceri Aktar
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Denetim Kaydi
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Ayarlar
              </NavLink>
            </>
          )}
        </nav>

        <div className="project-list-title">Atanan Projeler</div>
        <input
          className="sidebar-project-search"
          placeholder="Proje ara..."
          value={projectQuery}
          onChange={(event) => setProjectQuery(event.target.value)}
        />
        <div className="project-list">
          {filteredProjects.map((project) => (
            <Link key={project.id} className="project-item" to={`/projects?project=${project.id}`}>
              <div>
                <strong>{project.name}</strong>
                <small>{project.tags.join(" • ")}</small>
              </div>
              <span>{project.keyCount}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <div>
            <strong>{user.name}</strong>
            <small>{user.role.toUpperCase()}</small>
          </div>
          <button type="button" onClick={logout}>
            Cikis Yap
          </button>
        </div>
      </aside>

      <main className="content-area">
        <header className="content-header">
          <div>{pathname}</div>
          {user.role === "viewer" ? (
            <span className="readonly-pill">Salt okunur mod</span>
          ) : (
            <span className="readonly-pill editable">Duzenleme aktif</span>
          )}
        </header>
        <Outlet />
      </main>
    </div>
  );
}
