import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UsersPage } from "@features/users/UsersPage";
import type { ManagedUser } from "@core/types";

// --- Mock data ---
const mockUsers: ManagedUser[] = [
  { id: "u1", email: "admin@test.com", displayName: "Admin", role: "admin", isActive: true, createdAt: "2025-01-01" },
  { id: "u2", email: "member@test.com", displayName: "Uye", role: "member", isActive: true, createdAt: "2025-01-02" },
];

// --- Mock'lar ---
const mockFetchUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchUsers: (...args: unknown[]) => mockFetchUsers(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
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
  mockFetchUsers.mockResolvedValue(mockUsers);
});

describe("UsersPage", () => {
  it("kullanıcı listesini gosterir", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      expect(screen.getByText("member@test.com")).toBeInTheDocument();
    });
    // roleLabels: admin -> "Yönetici", member -> "Üye"
    expect(screen.getByText("Yönetici")).toBeInTheDocument();
    // "Uye" appears as displayName; role badge for member is "Üye"
    expect(screen.getAllByText("Uye").length).toBeGreaterThanOrEqual(1);
  });

  it("yeni kullanıcı formu acilir ve kapanir", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => expect(screen.getByText("Admin")).toBeInTheDocument());

    const btn = screen.getByRole("button", { name: /Yeni Kullanıcı/i });
    await user.click(btn);
    // Placeholders in the create form
    expect(screen.getByPlaceholderText("ornek@sirket.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ad Soyad")).toBeInTheDocument();

    // Clicking the same toggle button again (now labeled "İptal") closes the form
    await user.click(screen.getByRole("button", { name: /İptal/i }));
    expect(screen.queryByPlaceholderText("ornek@sirket.com")).not.toBeInTheDocument();
  });

  it("yeni kullanıcı olusturulur", async () => {
    mockCreateUser.mockResolvedValueOnce({
      id: "u3",
      email: "new@test.com",
      displayName: "Yeni",
      role: "member",
      isActive: true,
      createdAt: "2025-01-03",
    });
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => expect(screen.getByText("Admin")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Yeni Kullanıcı/i }));

    await user.type(screen.getByPlaceholderText("ornek@sirket.com"), "new@test.com");
    await user.type(screen.getByPlaceholderText("Ad Soyad"), "Yeni");
    await user.type(screen.getByPlaceholderText("Şifre"), "sifre123");
    await user.click(screen.getByRole("button", { name: /Oluştur/i }));

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "new@test.com",
        displayName: "Yeni",
        role: "member",
        password: "sifre123",
      });
      expect(mockShowToast).toHaveBeenCalledWith("Kullanıcı oluşturuldu", "success");
    });
  });

  it("kullanıcı listeleme hatasi gosterilir", async () => {
    mockFetchUsers.mockRejectedValueOnce(new Error("Sunucu hatasi"));
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Sunucu hatasi")).toBeInTheDocument();
    });
  });
});
