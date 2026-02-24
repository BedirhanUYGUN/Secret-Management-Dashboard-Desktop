import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPage } from "@features/search/SearchPage";

const mockFetchProjects = vi.fn();
const mockSearchSecrets = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchProjects: (...args: unknown[]) => mockFetchProjects(...args),
  searchSecrets: (...args: unknown[]) => mockSearchSecrets(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
  }),
}));

describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProjects.mockResolvedValue([{ id: "apollo", name: "Apollo", tags: [], keyCount: 1, prodAccess: true }]);
    mockSearchSecrets.mockResolvedValue([
      {
        id: "s1",
        projectId: "apollo",
        name: "Stripe Key",
        provider: "Stripe",
        type: "key",
        environment: "dev",
        keyName: "STRIPE_KEY",
        valueMasked: "sk_***",
        updatedAt: "2026-01-01T00:00:00Z",
        tags: ["payment"],
        notes: "",
        updatedByName: null,
        lastCopiedAt: null,
      },
    ]);
  });

  it("arama sonuclarini gosterir ve sorguyu gonderir", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Stripe Key")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/anahtar ile ara/i);
    await user.clear(input);
    await user.type(input, "stripe");

    await waitFor(() => {
      expect(mockSearchSecrets).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: "stripe" }),
      );
    });
  });
});
