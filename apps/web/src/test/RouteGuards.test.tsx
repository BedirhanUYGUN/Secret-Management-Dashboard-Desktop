import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth, RequireRole } from "@core/auth/RouteGuards";
import type { Role } from "@core/types";

const authState: { isAuthenticated: boolean; role: Role | null } = {
  isAuthenticated: false,
  role: null,
};

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    user: authState.role
      ? { id: "u1", name: "Test", role: authState.role, assignments: [], preferences: {} }
      : null,
  }),
}));

describe("RouteGuards", () => {
  it("giriş yoksa RequireAuth login sayfasina yonlendirir", () => {
    authState.isAuthenticated = false;
    authState.role = null;

    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/projects" element={<div>Projects</div>} />
          </Route>
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("yetkisiz rolde RequireRole projects sayfasina yonlendirir", () => {
    authState.isAuthenticated = true;
    authState.role = "member";

    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route element={<RequireRole allowed={["admin"]} />}>
            <Route path="/users" element={<div>Users</div>} />
          </Route>
          <Route path="/projects" element={<div>Projects</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("yetkili rolde RequireRole icerigi gosterir", () => {
    authState.isAuthenticated = true;
    authState.role = "admin";

    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route element={<RequireRole allowed={["admin"]} />}>
            <Route path="/users" element={<div>Users</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Users")).toBeInTheDocument();
  });
});
