import { render, screen, waitFor, within } from "@testing-library/react";
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
const mockRemoveProjectMember = vi.fn();
const mockUpdateEnvironmentAccess = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchProjectDetails: (...args: unknown[]) => mockFetchProjectDetails(...args),
  fetchUsers: (...args: unknown[]) => mockFetchUsers(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  addProjectMember: (...args: unknown[]) => mockAddProjectMember(...args),
  removeProjectMember: (...args: unknown[]) => mockRemoveProjectMember(...args),
  updateEnvironmentAccess: (...args: unknown[]) => mockUpdateEnvironmentAccess(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
    loading: false,
  }),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({ showToast: mockShowToast }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchProjectDetails.mockResolvedValue(mockProjects);
  mockFetchUsers.mockResolvedValue(mockAllUsers);
});

describe("ProjectManagePage", () => {
  it("proje listesini gosterir", async () => {
    render(<ProjectManagePage />);

    await waitFor(() => {
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
    });
  });

  it("yeni proje olusturma formu acilir", async () => {
    const user = userEvent.setup();
    render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getByText("Apollo API")).toBeInTheDocument());
    await user.click(screen.getByText("Yeni Proje"));

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

    await waitFor(() => expect(screen.getByText("Apollo API")).toBeInTheDocument());
    await user.click(screen.getByText("Yeni Proje"));

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
    const { container } = render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getByText("Apollo API")).toBeInTheDocument());
    await user.click(screen.getByText("Apollo API"));

    const detailSection = container.querySelector(".detail-section");
    expect(detailSection).not.toBeNull();

    await waitFor(() => {
      expect(within(detailSection as HTMLElement).getByText(/apollo-api/)).toBeInTheDocument();
      expect(within(detailSection as HTMLElement).getByText(/admin@test.com/)).toBeInTheDocument();
    });
  });

  it("proje silinir", async () => {
    mockDeleteProject.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ProjectManagePage />);

    await waitFor(() => expect(screen.getByText("Apollo API")).toBeInTheDocument());
    await user.click(screen.getByText("Apollo API"));

    await waitFor(() => expect(screen.getByText("Sil")).toBeInTheDocument());
    await user.click(screen.getByText("Sil"));

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith("p1");
      expect(mockShowToast).toHaveBeenCalledWith("Proje silindi", "success");
    });
  });
});
