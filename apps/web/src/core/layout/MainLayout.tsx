import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchProjects, type ProjectSummary } from "../api/client";
import { isTauriRuntime } from "../platform/runtime";
import { Modal } from "../ui/Modal";

const pageTitles: Record<string, string> = {
  "/projects": "Projeler",
  "/organizations": "Organizasyonlar",
  "/search": "Arama",
  "/settings": "Ayarlar",
  "/users": "Kullanıcılar",
  "/project-manage": "Proje Yönetimi",
  "/import": "İçeri Aktar",
  "/audit": "Denetim Kaydı",
};

const brandName = "SırIKI";

export function MainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [assignedProjects, setAssignedProjects] = useState<ProjectSummary[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const pageTitle = pageTitles[pathname];
    document.title = pageTitle ? `${brandName} • ${pageTitle}` : brandName;
  }, [pathname]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void fetchProjects()
      .then(setAssignedProjects)
      .catch(() => setAssignedProjects([]));
  }, [user]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Shift+? for shortcuts modal (works everywhere)
      if (event.shiftKey && event.key === "?") {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName ?? "";
        const isTypingTarget = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (!isTypingTarget && !target?.isContentEditable) {
          event.preventDefault();
          setShowShortcuts((prev) => !prev);
          return;
        }
      }

      if (!isTauriRuntime()) {
        return;
      }

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
      <a href="#main-content" className="skip-to-content">Ana icerige atla</a>

      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-label="Menu"
      >
        ☰
      </button>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? "sidebar-backdrop-visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img className="sidebar-brand-logo" src="/siriki-logo.svg" alt="" aria-hidden="true" />
          <div className="sidebar-brand-text">
            <strong>{brandName}</strong>
            <small>Secret Management Workspace</small>
          </div>
        </div>
        <nav className="main-nav">
          <NavLink to="/projects" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Projeler
          </NavLink>
          {user.role !== "viewer" && (
            <>
              <NavLink to="/organizations" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Organizasyonlar
              </NavLink>
              <NavLink to="/project-manage" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Proje Yönetimi
              </NavLink>
            </>
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
                Kullanıcılar
              </NavLink>
              <NavLink to="/import" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                İçeri Aktar
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Denetim Kaydı
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
          <button type="button" onClick={logout} data-tooltip="Oturumu kapat" data-tooltip-position="left">
            Çıkış Yap
          </button>
        </div>
      </aside>

      <main className="content-area" id="main-content">
        <header className="content-header">
          <div className="breadcrumb">{breadcrumb.map((part, index) => (
            <span key={index}>
              {index > 0 && <span className="breadcrumb-separator"> &rsaquo; </span>}
              {part}
            </span>
          ))}</div>
          <div className="content-header-right">
            {isTauriRuntime() && <small className="desktop-shortcut-hint" data-tooltip="Shift+? ile tum kisayollari gor">Ctrl+1-4 hızlı geçiş, Ctrl+Shift+L çıkış</small>}
            <button
              type="button"
              className="shortcuts-help-btn"
              onClick={() => setShowShortcuts(true)}
              data-tooltip="Klavye kisayollari"
            >
              ?
            </button>
            {user.role === "viewer" ? (
              <span className="readonly-pill">Salt okunur mod</span>
            ) : (
              <span className="readonly-pill editable">Düzenleme aktif</span>
            )}
          </div>
        </header>
        <Outlet />
      </main>

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Klavye Kisayollari">
        <table className="shortcut-table">
          <tbody>
            <tr>
              <td><kbd className="shortcut-kbd">Ctrl</kbd> + <kbd className="shortcut-kbd">1</kbd></td>
              <td>Projeler sayfasi</td>
            </tr>
            <tr>
              <td><kbd className="shortcut-kbd">Ctrl</kbd> + <kbd className="shortcut-kbd">2</kbd></td>
              <td>Arama sayfasi</td>
            </tr>
            <tr>
              <td><kbd className="shortcut-kbd">Ctrl</kbd> + <kbd className="shortcut-kbd">3</kbd></td>
              <td>Ayarlar sayfasi</td>
            </tr>
            <tr>
              <td><kbd className="shortcut-kbd">Ctrl</kbd> + <kbd className="shortcut-kbd">4</kbd></td>
              <td>Kullanicilar sayfasi (admin)</td>
            </tr>
            <tr>
              <td><kbd className="shortcut-kbd">Ctrl</kbd> + <kbd className="shortcut-kbd">Shift</kbd> + <kbd className="shortcut-kbd">L</kbd></td>
              <td>Oturumu kapat</td>
            </tr>
            <tr>
              <td><kbd className="shortcut-kbd">Shift</kbd> + <kbd className="shortcut-kbd">?</kbd></td>
              <td>Bu yardim penceresini ac/kapat</td>
            </tr>
          </tbody>
        </table>
      </Modal>
    </div>
  );
}
