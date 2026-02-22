import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth, RequireRole } from "./auth/RouteGuards";
import { MainLayout } from "./layout/MainLayout";
import { AuditPage } from "./pages/AuditPage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectManagePage } from "./pages/ProjectManagePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { AppUiProvider } from "./ui/AppUiContext";
import { ToastViewport } from "./ui/ToastViewport";

function App() {
  return (
    <AuthProvider>
      <AppUiProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/projects" replace />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/search" element={<SearchPage />} />

                <Route element={<RequireRole allowed={["admin"]} />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/project-manage" element={<ProjectManagePage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
          <ToastViewport />
        </BrowserRouter>
      </AppUiProvider>
    </AuthProvider>
  );
}

export default App;
