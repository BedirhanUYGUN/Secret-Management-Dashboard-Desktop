import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchProjects, type ProjectSummary } from "../api/client";
import { isTauriRuntime } from "../platform/runtime";

const pageTitles: Record<string, string> = {
  "/projects": "Projeler",
  "/organizations": "Organizasyonlar",
  "/search": "Arama",
  "/settings": "Ayarlar",
  "/users": "Kullanicilar",
  "/project-manage": "Proje Yonetimi",
  "/import": "Iceri Aktar",
  "/audit": "Denetim Kaydi",
};

export function MainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isTypingTarget = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
      if (isTypingTarget || target?.isContentEditable) {
        return;
      }

      switch (event.key) {
        case "1":
          event.preventDefault();
          navigate("/projects");
          break;
        case "2":
          event.preventDefault();
          navigate("/search");
          break;
        case "3":
          event.preventDefault();
          navigate("/settings");
          break;
        case "4":
          if (user?.role === "admin") {
            event.preventDefault();
            navigate("/users");
          }
          break;
        case "l":
        case "L":
          if (event.shiftKey) {
            event.preventDefault();
            logout();
          }
          break;
        default:
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate, logout, user?.role]);

  const breadcrumb = useMemo(() => {
    const pageTitle = pageTitles[pathname] ?? pathname;
    const parts: string[] = [pageTitle];

    if (pathname === "/projects") {
      const projectId = searchParams.get("project");
      const env = searchParams.get("env");
      if (projectId) {
        const project = assignedProjects.find((p) => p.id === projectId);
        if (project) {
          parts.push(project.name);
        }
      }
      if (env) {
        parts.push(env.toUpperCase());
      }
    }

    return parts;
  }, [pathname, searchParams, assignedProjects]);

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
          {user.role !== "viewer" && (
            <NavLink to="/organizations" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Organizasyonlar
            </NavLink>
          )}
          <NavLink to="/search" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Arama
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Ayarlar
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
          <div className="breadcrumb">{breadcrumb.map((part, index) => (
            <span key={index}>
              {index > 0 && <span className="breadcrumb-separator"> &rsaquo; </span>}
              {part}
            </span>
          ))}</div>
          <div className="content-header-right">
            {isTauriRuntime() && <small className="desktop-shortcut-hint">Ctrl+1-4 hizli gecis, Ctrl+Shift+L cikis</small>}
            {user.role === "viewer" ? (
              <span className="readonly-pill">Salt okunur mod</span>
            ) : (
              <span className="readonly-pill editable">Duzenleme aktif</span>
            )}
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
