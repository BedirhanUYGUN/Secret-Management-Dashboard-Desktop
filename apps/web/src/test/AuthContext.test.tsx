import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "../auth/AuthContext";

// --- Mock'lar ---
const mockFetchMe = vi.fn();
const mockLoginWithCredentials = vi.fn();
const mockLogoutSession = vi.fn();
const mockClearTokens = vi.fn();

vi.mock("../api/client", () => ({
  fetchMe: (...args: unknown[]) => mockFetchMe(...args),
  loginWithCredentials: (...args: unknown[]) => mockLoginWithCredentials(...args),
  logoutSession: (...args: unknown[]) => mockLogoutSession(...args),
  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
}));

// Test icin AuthContext kullanan yardimci component
function TestConsumer() {
  const { isAuthenticated, user, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? "giris-yapildi" : "giris-yapilmadi"}</span>
      <span data-testid="user">{user?.name ?? "yok"}</span>
      <span data-testid="loading">{loading ? "yukleniyor" : "hazir"}</span>
      <button onClick={() => void login("a@b.com", "pass")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("AuthContext", () => {
  it("token yoksa giris yapilmamis durumda baslar", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("hazir");
    });
    expect(screen.getByTestId("auth")).toHaveTextContent("giris-yapilmadi");
    expect(screen.getByTestId("user")).toHaveTextContent("yok");
  });

  it("token varsa otomatik olarak kullanici bilgisini yukler", async () => {
    localStorage.setItem("api-key-organizer-access-token", "mock-token");
    mockFetchMe.mockResolvedValueOnce({
      id: "1",
      name: "Admin",
      role: "admin",
      assignments: [],
      preferences: {},
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("hazir");
    });
    expect(screen.getByTestId("auth")).toHaveTextContent("giris-yapildi");
    expect(screen.getByTestId("user")).toHaveTextContent("Admin");
  });

  it("login basarili oldugunda kullanici set edilir", async () => {
    mockLoginWithCredentials.mockResolvedValueOnce(undefined);
    mockFetchMe.mockResolvedValueOnce({
      id: "2",
      name: "Test User",
      role: "member",
      assignments: [],
      preferences: {},
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("hazir");
    });

    await act(async () => {
      screen.getByText("login").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth")).toHaveTextContent("giris-yapildi");
      expect(screen.getByTestId("user")).toHaveTextContent("Test User");
    });
    expect(mockLoginWithCredentials).toHaveBeenCalledWith("a@b.com", "pass");
  });

  it("logout yapildiginda kullanici temizlenir", async () => {
    localStorage.setItem("api-key-organizer-access-token", "mock-token");
    mockFetchMe.mockResolvedValueOnce({
      id: "1",
      name: "Admin",
      role: "admin",
      assignments: [],
      preferences: {},
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth")).toHaveTextContent("giris-yapildi");
    });

    act(() => {
      screen.getByText("logout").click();
    });

    expect(screen.getByTestId("auth")).toHaveTextContent("giris-yapilmadi");
    expect(screen.getByTestId("user")).toHaveTextContent("yok");
  });

  it("token gecersiz oldugunda clearTokens cagirilir", async () => {
    localStorage.setItem("api-key-organizer-access-token", "invalid-token");
    mockFetchMe.mockRejectedValueOnce(new Error("401"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("hazir");
    });
    expect(screen.getByTestId("auth")).toHaveTextContent("giris-yapilmadi");
    expect(mockClearTokens).toHaveBeenCalled();
  });
});
