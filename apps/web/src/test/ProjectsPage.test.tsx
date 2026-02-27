import { render, screen, waitFor } from "@testing-library/react";
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
    confirm: () => Promise.resolve(true),
    dismissConfirm: () => {},
    confirmDialog: null,
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
  it("proje adı ve ortam tab'lari gorunur", async () => {
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

  it("secret satırına çift tıklayınca detay modalı açılır", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1));

    // Stripe satırına çift tıkla
    const tableRows = document.querySelectorAll(".table-row");
    const stripeRow = Array.from(tableRows).find((row) => row.textContent?.includes("Stripe Key"));
    if (stripeRow) {
      await user.dblClick(stripeRow as HTMLElement);
    }

    await waitFor(() => {
      expect(screen.getByText("Anahtar Detayları")).toBeInTheDocument();
      expect(screen.getAllByText("payment").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Test key")).toBeInTheDocument();
    });
  });

  it("yeni anahtar olusturma formu acilir", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Apollo API")).toBeInTheDocument());
    await user.click(screen.getByText("Anahtar Ekle"));

    expect(screen.getByPlaceholderText("Örn: Stripe API Key")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Örn: AWS, Stripe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Örn: STRIPE_SECRET_KEY")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Gizli anahtar değeri")).toBeInTheDocument();
  });

  it("filtreleme secenekleri mevcut", async () => {
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1));

    expect(screen.getByText("Tüm sağlayıcılar")).toBeInTheDocument();
    expect(screen.getByText("Tüm etiketler")).toBeInTheDocument();
    expect(screen.getByText("Tüm tipler")).toBeInTheDocument();
  });

  it("listeden kalem aksiyonu ile düzenleme modalı açılır", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1));

    await user.click(screen.getByRole("button", { name: /stripe key düzenle/i }));

    await waitFor(() => {
      expect(screen.getByText("Anahtarı Düzenle")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();
    });
  });

  it("atanmış proje yoksa uyari gosterir", async () => {
    mockFetchProjects.mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/henüz size atanmış bir proje yok/i)).toBeInTheDocument();
    });
  });
});
