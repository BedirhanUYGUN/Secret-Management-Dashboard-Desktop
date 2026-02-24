import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectsPage } from "@features/projects/ProjectsPage";
import type { Secret } from "@core/types";
import type { ProjectSummary } from "@core/api/client";

// --- Mock data ---
const mockProjectList: ProjectSummary[] = [
  { id: "p1", name: "Apollo API", tags: ["api"], keyCount: 3, prodAccess: true },
];

const mockSecrets: Secret[] = [
  {
    id: "s1",
    projectId: "p1",
    name: "Stripe Key",
    provider: "Stripe",
    type: "key",
    environment: "dev",
    keyName: "STRIPE_KEY",
    valueMasked: "sk_***xxx",
    updatedAt: "2025-06-01T12:00:00Z",
    tags: ["payment"],
    notes: "Test key",
    updatedByName: "Admin",
    lastCopiedAt: null,
  },
  {
    id: "s2",
    projectId: "p1",
    name: "DB URL",
    provider: "AWS",
    type: "endpoint",
    environment: "dev",
    keyName: "DATABASE_URL",
    valueMasked: "postgres://***",
    updatedAt: "2025-06-02T12:00:00Z",
    tags: ["infra"],
    notes: "",
    updatedByName: null,
    lastCopiedAt: "2025-06-03T10:00:00Z",
  },
];

// --- Mock'lar ---
const mockFetchProjects = vi.fn();
const mockFetchProjectSecrets = vi.fn();
const mockCreateProjectSecret = vi.fn();
const mockDeleteProjectSecret = vi.fn();
const mockUpdateProjectSecret = vi.fn();
const mockRevealSecretValue = vi.fn();
const mockTrackCopyEvent = vi.fn();
const mockShowToast = vi.fn();
const mockCopyWithTimer = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchProjects: (...args: unknown[]) => mockFetchProjects(...args),
  fetchProjectSecrets: (...args: unknown[]) => mockFetchProjectSecrets(...args),
  createProjectSecret: (...args: unknown[]) => mockCreateProjectSecret(...args),
  deleteProjectSecret: (...args: unknown[]) => mockDeleteProjectSecret(...args),
  updateProjectSecret: (...args: unknown[]) => mockUpdateProjectSecret(...args),
  revealSecretValue: (...args: unknown[]) => mockRevealSecretValue(...args),
  trackCopyEvent: (...args: unknown[]) => mockTrackCopyEvent(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", role: "admin", assignments: [], preferences: {} },
    loading: false,
  }),
}));

vi.mock("@core/ui/AppUiContext", () => ({
  useAppUi: () => ({
    showToast: mockShowToast,
    copyWithTimer: mockCopyWithTimer,
  }),
}));

vi.mock("@core/ui/ExportModal", () => ({
  ExportModal: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchProjects.mockResolvedValue(mockProjectList);
  mockFetchProjectSecrets.mockResolvedValue(mockSecrets);
});

describe("ProjectsPage", () => {
  it("proje adi ve ortam tab'lari gorunur", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
    });
    expect(screen.getByText("LOCAL")).toBeInTheDocument();
    // DEV appears in tab + secret rows, use button selector
    expect(screen.getByRole("button", { name: "DEV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PROD" })).toBeInTheDocument();
  });

  it("secret listesi gosterilir", async () => {
    renderPage();

    await waitFor(() => {
      // Stripe Key appears in both list and detail panel
      expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("DB URL")).toBeInTheDocument();
    });
  });

  it("secret secildiginde detay paneli goruntulenir", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await waitFor(() => expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1));

    // table-row icindeki Stripe Key satirina tikla
    const tableRows = document.querySelectorAll(".table-row");
    if (tableRows.length > 0) {
      await user.click(tableRows[0] as HTMLElement);
    }

    // Detay panelinde bilgiler gorunur
    const detailSection = container.querySelector(".detail-section");
    expect(detailSection).not.toBeNull();

    await waitFor(() => {
      expect(within(detailSection as HTMLElement).getByText("payment")).toBeInTheDocument();
      expect(within(detailSection as HTMLElement).getByText("Test key")).toBeInTheDocument();
    });
  });

  it("yeni anahtar olusturma formu acilir", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Apollo API")).toBeInTheDocument());
    await user.click(screen.getByText("Anahtar Ekle"));

    expect(screen.getByPlaceholderText("Ad")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Saglayici")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ANAHTAR_ADI")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Gizli Deger")).toBeInTheDocument();
  });

  it("filtreleme secenekleri mevcut", async () => {
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1));

    expect(screen.getByText("Tum saglayicilar")).toBeInTheDocument();
    expect(screen.getByText("Tum etiketler")).toBeInTheDocument();
    expect(screen.getByText("Tum tipler")).toBeInTheDocument();
  });

  it("atanmis proje yoksa uyari gosterir", async () => {
    mockFetchProjects.mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/atanmis proje bulunmuyor/i)).toBeInTheDocument();
    });
  });
});
