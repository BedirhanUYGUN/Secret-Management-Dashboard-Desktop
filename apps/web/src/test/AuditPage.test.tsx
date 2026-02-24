import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditPage } from "@features/audit/AuditPage";

const mockFetchAudit = vi.fn();
const mockFetchProjects = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchAudit: (...args: unknown[]) => mockFetchAudit(...args),
  fetchProjects: (...args: unknown[]) => mockFetchProjects(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
  }),
}));

describe("AuditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProjects.mockResolvedValue([{ id: "apollo", name: "Apollo", tags: [], keyCount: 1, prodAccess: true }]);
    mockFetchAudit.mockResolvedValue([
      {
        id: "a1",
        action: "secret_deleted",
        actor: "admin@test.com",
        projectId: "apollo",
        secretName: "STRIPE_KEY",
        occurredAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("audit listesini gosterir ve action filtresi uygular", async () => {
    const user = userEvent.setup();
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText("STRIPE_KEY")).toBeInTheDocument();
    });

    const actionSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(actionSelect, "secret_deleted");

    await waitFor(() => {
      expect(mockFetchAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "secret_deleted" }),
      );
    });
  });
});
