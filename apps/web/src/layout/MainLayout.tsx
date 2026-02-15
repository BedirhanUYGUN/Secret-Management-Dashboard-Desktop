import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { projects, secrets } from "../data/mockData";
import { useAuth } from "../auth/AuthContext";

function countKeys(projectId: string) {
  return secrets.filter((item) => item.projectId === projectId).length;
}

export function MainLayout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const assignedIds = new Set(user.assignments.map((item) => item.projectId));
  const assignedProjects = projects.filter((project) => assignedIds.has(project.id));

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-title">API Key Organizer</div>
        <nav className="main-nav">
          <NavLink to="/projects" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Projects
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Search
          </NavLink>
          {user.role === "admin" && (
            <>
              <NavLink to="/import" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Import
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Audit
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Settings
              </NavLink>
            </>
          )}
        </nav>

        <div className="project-list-title">Assigned Projects</div>
        <div className="project-list">
          {assignedProjects.map((project) => (
            <Link key={project.id} className="project-item" to={`/projects?project=${project.id}`}>
              <div>
                <strong>{project.name}</strong>
                <small>{project.tags.join(" • ")}</small>
              </div>
              <span>{countKeys(project.id)}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <div>
            <strong>{user.name}</strong>
            <small>{user.role.toUpperCase()}</small>
          </div>
          <button type="button" onClick={logout}>
            Log Out
          </button>
        </div>
      </aside>

      <main className="content-area">
        <header className="content-header">
          <div>{pathname}</div>
          {user.role === "viewer" ? (
            <span className="readonly-pill">Read-only mode</span>
          ) : (
            <span className="readonly-pill editable">Edit enabled</span>
          )}
        </header>
        <Outlet />
      </main>
    </div>
  );
}
