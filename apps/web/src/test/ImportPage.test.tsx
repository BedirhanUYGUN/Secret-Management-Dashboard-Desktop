import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportPage } from "@features/import/ImportPage";

const mockFetchProjects = vi.fn();
const mockPreviewImport = vi.fn();
const mockCommitImport = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchProjects: (...args: unknown[]) => mockFetchProjects(...args),
  previewImport: (...args: unknown[]) => mockPreviewImport(...args),
  commitImport: (...args: unknown[]) => mockCommitImport(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
  }),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }),
}));

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProjects.mockResolvedValue([{ id: "apollo", name: "Apollo", tags: [], keyCount: 1, prodAccess: true }]);
    mockPreviewImport.mockResolvedValue({
      heading: "Apollo",
      totalPairs: 1,
      skipped: 0,
      preview: [{ key: "API_KEY", value: "val" }],
    });
    mockCommitImport.mockResolvedValue({
      projectId: "apollo",
      environment: "dev",
      inserted: 1,
      updated: 0,
      skipped: 0,
      total: 1,
    });
  });

  it("önizleme ve commit akislarini calistirir", async () => {
    const user = userEvent.setup();
    render(<ImportPage />);

    expect(screen.queryByText(/çatışma: yeni surum/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Önizleme" }));

    await waitFor(() => {
      expect(mockPreviewImport).toHaveBeenCalled();
      expect(screen.getByText(/toplam çift/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "İçeri Aktar" }));

    await waitFor(() => {
      expect(mockCommitImport).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "apollo",
          environment: "dev",
          conflictStrategy: "skip",
        }),
      );
      expect(mockShowToast).toHaveBeenCalledWith("İçeri aktarım işlemi tamamlandı", "success");
    });
  });
});
