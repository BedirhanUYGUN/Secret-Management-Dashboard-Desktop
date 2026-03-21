import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectManagePage } from "@features/project-manage/ProjectManagePage";
import type { ManagedUser, ProjectDetail } from "@core/types";

// --- Mock data ---
const mockProjects: ProjectDetail[] = [
  {
    id: "p1",
    slug: "apollo-api",
    name: "Apollo API",
    description: "Test API",
    tags: ["api"],
    members: [{ userId: "u1", email: "admin@test.com", displayName: "Admin", role: "admin" }],
  },
];

const mockAllUsers: ManagedUser[] = [
  { id: "u1", email: "admin@test.com", displayName: "Admin", role: "admin", isActive: true, createdAt: "2025-01-01" },
  { id: "u2", email: "member@test.com", displayName: "Uye", role: "member", isActive: true, createdAt: "2025-01-02" },
];

// --- Mock'lar ---
const mockFetchProjectDetails = vi.fn();
const mockFetchUsers = vi.fn();
const mockCreateProject = vi.fn();
const mockUpdateProject = vi.fn();
const mockDeleteProject = vi.fn();
const mockAddProjectMember = vi.fn();
const mockFetchServiceTokens = vi.fn();
const mockCreateServiceToken = vi.fn();
const mockUpdateProjectMemberRole = vi.fn();
const mockRemoveProjectMember = vi.fn();
const mockRevokeServiceToken = vi.fn();
const mockUpdateEnvironmentAccess = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchProjectDetails: (...args: unknown[]) => mockFetchProjectDetails(...args),
  fetchUsers: (...args: unknown[]) => mockFetchUsers(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  addProjectMember: (...args: unknown[]) => mockAddProjectMember(...args),
  fetchServiceTokens: (...args: unknown[]) => mockFetchServiceTokens(...args),
  createServiceToken: (...args: unknown[]) => mockCreateServiceToken(...args),
  updateProjectMemberRole: (...args: unknown[]) => mockUpdateProjectMemberRole(...args),
  removeProjectMember: (...args: unknown[]) => mockRemoveProjectMember(...args),
  revokeServiceToken: (...args: unknown[]) => mockRevokeServiceToken(...args),
  updateEnvironmentAccess: (...args: unknown[]) => mockUpdateEnvironmentAccess(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@test.com", name: "Admin", role: "admin", assignments: [], preferences: {} },
    loading: false,
  }),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({ showToast: mockShowToast, confirm: () => Promise.resolve(true), dismissConfirm: () => {}, confirmDialog: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchProjectDetails.mockResolvedValue(mockProjects);
  mockFetchUsers.mockResolvedValue(mockAllUsers);
  mockFetchServiceTokens.mockResolvedValue([]);
});

describe("ProjectManagePage", () => {
  it("proje listesini gosterir", async () => {
    render(<ProjectManagePage />);

    await waitFor(() => {
      expect(screen.getAllByText("Apollo API").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("yeni proje olusturma formu acilir", async () => {
    const user = userEvent.setup();
    render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getAllByText("Apollo API").length).toBeGreaterThanOrEqual(1));
    // The button is labeled "Yeni" (not "Yeni Proje") in the new UI
    await user.click(screen.getByRole("button", { name: /Yeni/i }));

    expect(screen.getByPlaceholderText("Proje Adı")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/slug/i)).toBeInTheDocument();
  });

  it("yeni proje olusturulur", async () => {
    mockCreateProject.mockResolvedValueOnce({
      id: "p2",
      slug: "yeni",
      name: "Yeni Proje",
      description: "",
      tags: [],
      members: [],
    });
    const user = userEvent.setup();
    render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getAllByText("Apollo API").length).toBeGreaterThanOrEqual(1));
    await user.click(screen.getByRole("button", { name: /Yeni/i }));

    await user.type(screen.getByPlaceholderText("Proje Adı"), "Yeni Proje");
    await user.type(screen.getByPlaceholderText(/slug/i), "yeni-proje");
    await user.click(screen.getByText("Oluştur"));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Yeni Proje", slug: "yeni-proje" }),
      );
      expect(mockShowToast).toHaveBeenCalledWith("Proje oluşturuldu", "success");
    });
  });

  it("proje secildiginde detay goruntulenir", async () => {
    const user = userEvent.setup();
    render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getAllByText("Apollo API").length).toBeGreaterThanOrEqual(1));
    // Click the project name button in the left panel (first occurrence)
    await user.click(screen.getAllByText("Apollo API")[0]);

    // After selection, slug and member email appear (slug appears in both panels — use getAllByText)
    await waitFor(() => {
      expect(screen.getAllByText(/apollo-api/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/admin@test.com/)).toBeInTheDocument();
    });
  });

  it("proje silinir", async () => {
    mockDeleteProject.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getAllByText("Apollo API").length).toBeGreaterThanOrEqual(1));

    // The "Sil" button appears in the detail panel when a project is selected
    // First project is auto-selected, so "Sil" should be visible
    await waitFor(() => expect(screen.getByRole("button", { name: /^Sil$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^Sil$/i }));

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith("p1");
      expect(mockShowToast).toHaveBeenCalledWith("Proje silindi", "success");
    });
  });
});
