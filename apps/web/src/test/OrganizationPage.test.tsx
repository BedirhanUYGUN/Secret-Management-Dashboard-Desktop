import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationPage } from "@features/organization/OrganizationPage";

const mockFetchManagedOrganizations = vi.fn();
const mockFetchOrganizationInvites = vi.fn();
const mockFetchProjectDetails = vi.fn();
const mockFetchUsers = vi.fn();
const mockAddProjectMember = vi.fn();
const mockRemoveProjectMember = vi.fn();
const mockCreateOrganizationInvite = vi.fn();
const mockRotateOrganizationInvite = vi.fn();
const mockRevokeOrganizationInvite = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchManagedOrganizations: (...args: unknown[]) => mockFetchManagedOrganizations(...args),
  fetchOrganizationInvites: (...args: unknown[]) => mockFetchOrganizationInvites(...args),
  fetchProjectDetails: (...args: unknown[]) => mockFetchProjectDetails(...args),
  fetchUsers: (...args: unknown[]) => mockFetchUsers(...args),
  addProjectMember: (...args: unknown[]) => mockAddProjectMember(...args),
  removeProjectMember: (...args: unknown[]) => mockRemoveProjectMember(...args),
  createOrganizationInvite: (...args: unknown[]) => mockCreateOrganizationInvite(...args),
  rotateOrganizationInvite: (...args: unknown[]) => mockRotateOrganizationInvite(...args),
  revokeOrganizationInvite: (...args: unknown[]) => mockRevokeOrganizationInvite(...args),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({ showToast: (...args: unknown[]) => mockShowToast(...args), confirm: () => Promise.resolve(true), dismissConfirm: () => {}, confirmDialog: null }),
}));

describe("OrganizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchManagedOrganizations.mockResolvedValue([
      { projectId: "nova", projectName: "Nova Labs", memberCount: 3 },
    ]);
    mockFetchOrganizationInvites.mockResolvedValue([]);
    mockFetchProjectDetails.mockResolvedValue([
      {
        id: "p1",
        slug: "nova",
        name: "Nova Labs",
        description: "",
        tags: [],
        members: [{ userId: "u1", email: "admin@nova.com", displayName: "Admin", role: "admin" }],
      },
    ]);
    mockFetchUsers.mockResolvedValue([
      { id: "u1", email: "admin@nova.com", displayName: "Admin", role: "admin", isActive: true, createdAt: "2026-01-01" },
    ]);
    mockAddProjectMember.mockResolvedValue(undefined);
    mockRemoveProjectMember.mockResolvedValue(undefined);
    mockCreateOrganizationInvite.mockResolvedValue({
      id: "inv-1",
      projectId: "nova",
      isActive: true,
      maxUses: 0,
      usedCount: 0,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      codePreview: "hidden",
      code: "Aa1!Bb2@Cc3#",
    });
    mockRotateOrganizationInvite.mockResolvedValue({
      id: "inv-2",
      projectId: "nova",
      isActive: true,
      maxUses: 0,
      usedCount: 0,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      codePreview: "hidden",
      code: "Dd4$Ee5%Ff6^",
    });
    mockRevokeOrganizationInvite.mockResolvedValue(undefined);
  });

  it("yönetilen organizasyonları listeler ve yeni davet anahtarı üretir", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrganizationPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Nova Labs").length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getByRole("button", { name: /anahtar üret/i }));

    await waitFor(() => {
      expect(mockCreateOrganizationInvite).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "nova" }),
      );
      expect(screen.getByText("Aa1!Bb2@Cc3#")).toBeInTheDocument();
    });
  });
});
