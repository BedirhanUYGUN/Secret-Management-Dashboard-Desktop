import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportPage } from "../pages/ImportPage";

const mockFetchProjects = vi.fn();
const mockPreviewImport = vi.fn();
const mockCommitImport = vi.fn();
const mockShowToast = vi.fn();

vi.mock("../api/client", () => ({
  fetchProjects: (...args: unknown[]) => mockFetchProjects(...args),
  previewImport: (...args: unknown[]) => mockPreviewImport(...args),
  commitImport: (...args: unknown[]) => mockCommitImport(...args),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
  }),
}));

vi.mock("../ui/AppUiContext", () => ({
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

  it("onizleme ve commit akislarini calistirir", async () => {
    const user = userEvent.setup();
    render(<ImportPage />);

    expect(screen.queryByText(/catisma: yeni surum/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Onizleme" }));

    await waitFor(() => {
      expect(mockPreviewImport).toHaveBeenCalled();
      expect(screen.getByText(/toplam cift/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Iceri Aktar" }));

    await waitFor(() => {
      expect(mockCommitImport).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "apollo",
          environment: "dev",
          conflictStrategy: "skip",
        }),
      );
      expect(mockShowToast).toHaveBeenCalledWith("Iceri aktarim islemi tamamlandi", "success");
    });
  });
});
