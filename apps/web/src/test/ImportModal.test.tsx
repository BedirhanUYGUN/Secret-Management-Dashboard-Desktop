import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportModal } from "@core/ui/ImportModal";

const mockPreviewImport = vi.fn();
const mockCommitImport = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@core/api/client", () => ({
  previewImport: (...args: unknown[]) => mockPreviewImport(...args),
  commitImport: (...args: unknown[]) => mockCommitImport(...args),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }),
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  projectId: "proj-1",
  projectName: "Test Project",
  activeEnv: "dev" as const,
  onImported: vi.fn(),
};

describe("ImportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewImport.mockResolvedValue({
      heading: null,
      totalPairs: 2,
      skipped: 0,
      preview: [
        { key: "API_KEY", value: "val1" },
        { key: "DB_HOST", value: "val2" },
      ],
    });
    mockCommitImport.mockResolvedValue({
      projectId: "proj-1",
      environment: "dev",
      inserted: 2,
      updated: 0,
      skipped: 0,
      total: 2,
    });
  });

  it("açılıp kapanır", () => {
    const { rerender } = render(<ImportModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<ImportModal {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("içerik yapıştırıldığında otomatik önizleme tetiklenir", async () => {
    const user = userEvent.setup();
    render(<ImportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/API_KEY/);
    await user.click(textarea);
    await user.paste("API_KEY=sk-abc\nDB_HOST=localhost");

    await waitFor(() => {
      expect(mockPreviewImport).toHaveBeenCalledWith("API_KEY=sk-abc\nDB_HOST=localhost");
    });

    await waitFor(() => {
      expect(screen.getByText("2 çift")).toBeInTheDocument();
    });
  });

  it("commit sonrası özet gösterir", async () => {
    const user = userEvent.setup();
    render(<ImportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/API_KEY/);
    await user.click(textarea);
    await user.paste("API_KEY=sk-abc\nDB_HOST=localhost");

    await waitFor(() => expect(screen.getByText("2 çift")).toBeInTheDocument());

    // Click the commit button (the one inside the modal actions)
    const importButtons = screen.getAllByRole("button", { name: /İçeri Aktar/i });
    const commitButton = importButtons.find((btn) => !btn.hasAttribute("disabled"));
    expect(commitButton).toBeDefined();
    await user.click(commitButton!);

    await waitFor(() => {
      expect(mockCommitImport).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          environment: "dev",
          provider: "Imported",
          type: "key",
          conflictStrategy: "skip",
          tags: ["imported"],
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("2 eklenen")).toBeInTheDocument();
      expect(screen.getByText("0 atlanan")).toBeInTheDocument();
    });

    expect(defaultProps.onImported).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith("İçeri aktarım işlemi tamamlandı", "success");
  });
});
