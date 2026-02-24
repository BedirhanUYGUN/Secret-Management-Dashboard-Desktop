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
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
    loading: false,
  }),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({ showToast: mockShowToast }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchUsers.mockResolvedValue(mockUsers);
});

describe("UsersPage", () => {
  it("kullanici listesini gosterir", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      // "Uye" appears both as displayName and as role label
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      expect(screen.getByText("member@test.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Yonetici")).toBeInTheDocument();
    expect(screen.getAllByText("Uye").length).toBeGreaterThanOrEqual(1);
  });

  it("yeni kullanici formu acilir ve kapanir", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => expect(screen.getByText("Admin")).toBeInTheDocument());

    const btn = screen.getByText("Yeni Kullanici");
    await user.click(btn);
    expect(screen.getByPlaceholderText("E-posta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ad Soyad")).toBeInTheDocument();

    await user.click(screen.getByText("Iptal"));
    expect(screen.queryByPlaceholderText("E-posta")).not.toBeInTheDocument();
  });

  it("yeni kullanici olusturulur", async () => {
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
    await user.click(screen.getByText("Yeni Kullanici"));

    await user.type(screen.getByPlaceholderText("E-posta"), "new@test.com");
    await user.type(screen.getByPlaceholderText("Ad Soyad"), "Yeni");
    await user.type(screen.getByPlaceholderText("Sifre"), "sifre123");
    await user.click(screen.getByText("Olustur"));

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "new@test.com",
        displayName: "Yeni",
        role: "member",
        password: "sifre123",
      });
      expect(mockShowToast).toHaveBeenCalledWith("Kullanici olusturuldu", "success");
    });
  });

  it("kullanici listeleme hatasi gosterilir", async () => {
    mockFetchUsers.mockRejectedValueOnce(new Error("Sunucu hatasi"));
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Sunucu hatasi")).toBeInTheDocument();
    });
  });
});
