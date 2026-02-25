import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "@features/auth/RegisterPage";

const mockNavigate = vi.fn();
const mockRegisterWithProfile = vi.fn();
const mockLogin = vi.fn();

vi.mock("@core/api/client", () => ({
  registerWithProfile: (...args: unknown[]) => mockRegisterWithProfile(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({ login: (...args: unknown[]) => mockLogin(...args) }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("personel kaydında register ve login akislarini calistirir", async () => {
    mockRegisterWithProfile.mockResolvedValueOnce({ inviteCode: null });
    mockLogin.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^İsim$/i), "Ali");
    await user.type(screen.getByLabelText(/^soyisim$/i), "Yilmaz");
    await user.type(screen.getByLabelText(/e-posta/i), "ali@test.com");
    await user.type(screen.getByLabelText(/şifre/i), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: /kayıt ol/i }));

    await waitFor(() => {
      expect(mockRegisterWithProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Ali",
          lastName: "Yilmaz",
          email: "ali@test.com",
          purpose: "personal",
        }),
      );
      expect(mockLogin).toHaveBeenCalledWith("ali@test.com", "StrongPass1!");
      expect(mockNavigate).toHaveBeenCalledWith("/projects", { replace: true });
    });
  });

  it("organizasyon olusturma kaydında invite key gosterir", async () => {
    mockRegisterWithProfile.mockResolvedValueOnce({ inviteCode: "Ab1!Cd2@Ef3#" });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^İsim$/i), "Ayse");
    await user.type(screen.getByLabelText(/^soyisim$/i), "Kaya");
    await user.type(screen.getByLabelText(/e-posta/i), "ayse@test.com");
    await user.type(screen.getByLabelText(/şifre/i), "StrongPass1!");
    await user.selectOptions(screen.getByLabelText(/ne için kullanacaksınız/i), "organization");
    await user.type(screen.getByLabelText(/organizasyon adı/i), "Nova Labs");
    await user.click(screen.getByRole("button", { name: /kayıt ol/i }));

    await waitFor(() => {
      expect(screen.getByText(/organizasyon davet key oluşturuldu/i)).toBeInTheDocument();
      expect(screen.getByText("Ab1!Cd2@Ef3#")).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
