import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@core/auth/AuthContext";
import { RequireAuth, RequireRole } from "@core/auth/RouteGuards";
import { MainLayout } from "@core/layout/MainLayout";
import { AppUiProvider } from "@core/ui/AppUiContext";
import { ToastViewport } from "@core/ui/ToastViewport";
import { LoginPage } from "@features/auth/LoginPage";
import { AuditPage } from "@features/audit/AuditPage";
import { ImportPage } from "@features/import/ImportPage";
import { NotFoundPage } from "@features/not-found/NotFoundPage";
import { ProjectManagePage } from "@features/project-manage/ProjectManagePage";
import { ProjectsPage } from "@features/projects/ProjectsPage";
import { SearchPage } from "@features/search/SearchPage";
import { SettingsPage } from "@features/settings/SettingsPage";
import { UsersPage } from "@features/users/UsersPage";

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
                <Route path="/settings" element={<SettingsPage />} />

                <Route element={<RequireRole allowed={["admin"]} />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/project-manage" element={<ProjectManagePage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/audit" element={<AuditPage />} />
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
