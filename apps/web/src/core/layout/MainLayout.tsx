import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchProjects, type ProjectSummary } from "../api/client";
import { isTauriRuntime } from "../platform/runtime";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { cn } from "../ui/cn";
import {
  FolderKey,
  Search,
  Settings,
  Users,
  Upload,
  ClipboardList,
  Building2,
  FolderCog,
  LogOut,
  Menu,
  X,
  Keyboard,
  LayoutDashboard,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projeler",
  "/organizations": "Organizasyonlar",
  "/search": "Arama",
  "/settings": "Ayarlar",
  "/users": "Kullanicilar",
  "/project-manage": "Proje Yonetimi",
  "/import": "Iceri Aktar",
  "/audit": "Denetim Kaydi",
};

const brandName = "SirIKI";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projeler", icon: FolderKey },
  { to: "/organizations", label: "Organizasyonlar", icon: Building2, roles: ["admin", "member"] },
  { to: "/project-manage", label: "Proje Yonetimi", icon: FolderCog, roles: ["admin", "member"] },
  { to: "/search", label: "Arama", icon: Search },
  { to: "/settings", label: "Ayarlar", icon: Settings },
  { to: "/users", label: "Kullanicilar", icon: Users, adminOnly: true },
  { to: "/import", label: "Iceri Aktar", icon: Upload, adminOnly: true },
  { to: "/audit", label: "Denetim Kaydi", icon: ClipboardList, adminOnly: true },
];

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, toggle };
}

export function MainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [assignedProjects, setAssignedProjects] = useState<ProjectSummary[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const pageTitle = pageTitles[pathname];
    document.title = pageTitle ? `${brandName} - ${pageTitle}` : brandName;
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    void fetchProjects()
      .then(setAssignedProjects)
      .catch(() => setAssignedProjects([]));
  }, [user]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

      if (!isTauriRuntime()) return;

      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isTypingTarget = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
      if (isTypingTarget || target?.isContentEditable) return;

      switch (event.key) {
        case "1": event.preventDefault(); navigate("/projects"); break;
        case "2": event.preventDefault(); navigate("/search"); break;
        case "3": event.preventDefault(); navigate("/settings"); break;
        case "4":
          if (user?.role === "admin") { event.preventDefault(); navigate("/users"); }
          break;
        case "l": case "L":
          if (event.shiftKey) { event.preventDefault(); logout(); }
          break;
        default:
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); };
  }, [navigate, logout, user?.role]);

  const breadcrumb = useMemo(() => {
    const pageTitle = pageTitles[pathname] ?? pathname;
    const parts: string[] = [pageTitle];

    if (pathname === "/projects") {
      const projectId = searchParams.get("project");
      const env = searchParams.get("env");
      if (projectId) {
        const project = assignedProjects.find((p) => p.id === projectId);
        if (project) parts.push(project.name);
      }
      if (env) parts.push(env.toUpperCase());
    }

    return parts;
  }, [pathname, searchParams, assignedProjects]);

  if (!user) return null;

  const filteredProjects = assignedProjects.filter((project) =>
    project.name.toLowerCase().includes(projectQuery.trim().toLowerCase()),
  );

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) return user.role === "admin";
    if (item.roles) return item.roles.includes(user.role);
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <a href="#main-content" className="skip-to-content">Ana icerige atla</a>

      {/* Mobile menu button */}
      <button
        type="button"
        className="fixed top-3 left-3 z-50 rounded-md p-2 text-[var(--foreground)] hover:bg-[var(--accent)] lg:hidden cursor-pointer"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-label="Menu"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-[var(--sidebar-border)] px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
            <FolderKey className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold">{brandName}</span>
            <span className="text-xs text-[var(--muted-foreground)]">Secret Management</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--primary)]/10 text-[var(--sidebar-active)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Projects section */}
          <div className="mt-6">
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Atanan Projeler
            </div>
            <div className="px-1">
              <Input
                placeholder="Proje ara..."
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
              {filteredProjects.map((project) => (
                <Link
                  key={project.id}
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-[var(--sidebar-hover)]"
                  to={`/projects?project=${project.id}`}
                >
                  <div className="flex flex-col truncate">
                    <span className="truncate font-medium text-[var(--foreground)]">{project.name}</span>
                    {project.tags.length > 0 && (
                      <span className="truncate text-xs text-[var(--muted-foreground)]">
                        {project.tags.join(" - ")}
                      </span>
                    )}
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                    {project.keyCount}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--sidebar-border)] p-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col truncate">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{user.role.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)] cursor-pointer"
                title={theme === "dark" ? "Acik temaya gec" : "Koyu temaya gec"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--destructive)] cursor-pointer"
                title="Oturumu kapat"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden" id="main-content">
        <header className="flex h-14 items-center justify-between border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-1 text-sm">
            {breadcrumb.map((part, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />}
                <span className={index === breadcrumb.length - 1 ? "font-medium" : "text-[var(--muted-foreground)]"}>
                  {part}
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {isTauriRuntime() && (
              <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
                Ctrl+1-4 hizli gecis
              </span>
            )}
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] cursor-pointer"
              onClick={() => setShowShortcuts(true)}
              title="Klavye kisayollari"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            {user.role === "viewer" ? (
              <span className="rounded-full bg-warning-500/15 px-2.5 py-0.5 text-xs font-medium text-warning-500">
                Salt okunur
              </span>
            ) : (
              <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-medium text-brand-400">
                Duzenleme aktif
              </span>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Shortcuts modal */}
      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Klavye Kisayollari">
        <div className="space-y-2">
          {[
            { keys: ["Ctrl", "1"], desc: "Projeler sayfasi" },
            { keys: ["Ctrl", "2"], desc: "Arama sayfasi" },
            { keys: ["Ctrl", "3"], desc: "Ayarlar sayfasi" },
            { keys: ["Ctrl", "4"], desc: "Kullanicilar sayfasi (admin)" },
            { keys: ["Ctrl", "Shift", "L"], desc: "Oturumu kapat" },
            { keys: ["Shift", "?"], desc: "Bu pencereyi ac/kapat" },
          ].map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j}>
                    {j > 0 && <span className="mx-0.5 text-[var(--muted-foreground)]">+</span>}
                    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-xs font-medium">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
              <span className="text-sm text-[var(--muted-foreground)]">{shortcut.desc}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
