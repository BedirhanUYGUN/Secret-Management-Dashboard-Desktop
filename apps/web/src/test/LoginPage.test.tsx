import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "@features/auth/LoginPage";

// --- Mock'lar ---
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, loading: false }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("baslik ve form elemanlari gorunur", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /giriş yap/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ornek@sirket/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/şifrenizi girin/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /giriş yap/i })).toBeInTheDocument();
  });

  it("bos form gonderildiginde hata gosterir", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /giriş yap/i }));
    expect(screen.getByText(/zorunludur/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("basarili giriş sonrasi yonlendirme yapar", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/ornek@sirket/i), "admin@test.com");
    await user.type(screen.getByPlaceholderText(/şifrenizi girin/i), "sifre123");
    await user.click(screen.getByRole("button", { name: /giriş yap/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin@test.com", "sifre123");
      expect(mockNavigate).toHaveBeenCalledWith("/projects", { replace: true });
    });
  });

  it("yanlis kimlik bilgisi hata mesaji gosterir", async () => {
    mockLogin.mockRejectedValueOnce(new Error("401 Unauthorized"));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/ornek@sirket/i), "admin@test.com");
    await user.type(screen.getByPlaceholderText(/şifrenizi girin/i), "yanlis");
    await user.click(screen.getByRole("button", { name: /giriş yap/i }));

    await waitFor(() => {
      expect(screen.getByText(/hatalı/i)).toBeInTheDocument();
    });
  });

  it("ag hatasi mesaji gosterir", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Failed to fetch"));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/ornek@sirket/i), "admin@test.com");
    await user.type(screen.getByPlaceholderText(/şifrenizi girin/i), "sifre123");
    await user.click(screen.getByRole("button", { name: /giriş yap/i }));

    await waitFor(() => {
      expect(screen.getByText(/bağlanılamıyor/i)).toBeInTheDocument();
    });
  });
});
