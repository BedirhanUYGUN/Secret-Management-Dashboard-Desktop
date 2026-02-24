import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../pages/SettingsPage";

const mockUpdatePreferences = vi.fn();
const mockRefreshUser = vi.fn();
const mockSetClipboardSeconds = vi.fn();
const mockShowToast = vi.fn();

vi.mock("../api/client", () => ({
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      name: "Admin",
      role: "admin",
      assignments: [],
      preferences: { maskValues: true },
    },
    refreshUser: (...args: unknown[]) => mockRefreshUser(...args),
  }),
}));

vi.mock("../ui/AppUiContext", () => ({
  useAppUi: () => ({
    clipboardSeconds: 30,
    setClipboardSeconds: (...args: unknown[]) => mockSetClipboardSeconds(...args),
    showToast: (...args: unknown[]) => mockShowToast(...args),
  }),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatePreferences.mockResolvedValue({});
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it("ayarlar kaydedilir", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const numberInput = screen.getByRole("spinbutton");
    await user.clear(numberInput);
    await user.type(numberInput, "45");
    await user.click(screen.getByRole("button", { name: /tercihleri kaydet/i }));

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        maskValues: true,
        clipboardSeconds: 45,
      });
      expect(mockSetClipboardSeconds).toHaveBeenCalledWith(45);
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith("Ayarlar kaydedildi", "success");
    });
  });
});
