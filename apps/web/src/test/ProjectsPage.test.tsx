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
    version: 1,
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
    version: 2,
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
const mockFetchSecretVersions = vi.fn();
const mockUpdateProjectSecret = vi.fn();
const mockRevealSecretValue = vi.fn();
const mockRestoreSecretVersion = vi.fn();
const mockTrackCopyEvent = vi.fn();
const mockShowToast = vi.fn();
const mockCopyWithTimer = vi.fn();

vi.mock("@core/api/client", () => ({
  fetchProjects: (...args: unknown[]) => mockFetchProjects(...args),
  fetchProjectSecrets: (...args: unknown[]) => mockFetchProjectSecrets(...args),
  createProjectSecret: (...args: unknown[]) => mockCreateProjectSecret(...args),
  deleteProjectSecret: (...args: unknown[]) => mockDeleteProjectSecret(...args),
  fetchSecretVersions: (...args: unknown[]) => mockFetchSecretVersions(...args),
  updateProjectSecret: (...args: unknown[]) => mockUpdateProjectSecret(...args),
  revealSecretValue: (...args: unknown[]) => mockRevealSecretValue(...args),
  restoreSecretVersion: (...args: unknown[]) => mockRestoreSecretVersion(...args),
  trackCopyEvent: (...args: unknown[]) => mockTrackCopyEvent(...args),
}));

vi.mock("@core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@test.com", name: "Admin", role: "admin", assignments: [], preferences: {} },
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

function renderPage(initialEntries: string[] = ["/projects?project=p1"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchProjects.mockResolvedValue(mockProjectList);
  mockFetchProjectSecrets.mockResolvedValue(mockSecrets);
  mockFetchSecretVersions.mockResolvedValue([]);
});

describe("ProjectsPage", () => {
  it("proje adı ve ortam tab'lari gorunur", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
    });
    // Environment tabs render as role="tab" (TabsTrigger component)
    expect(screen.getByRole("tab", { name: "LOCAL" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "DEV" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PROD" })).toBeInTheDocument();
  });

  it("secret listesi gosterilir", async () => {
    renderPage();

    await waitFor(() => {
      // Stripe Key appears in the list
      expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("DB URL")).toBeInTheDocument();
    });
  });

  it("secret satırına Enter tusuyla detay modalı açılır", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Stripe Key").length).toBeGreaterThanOrEqual(1));

    // Secret rows have role="button" and respond to keyboard Enter key to open modal
    const secretRows = screen.getAllByRole("button");
    const stripeRow = secretRows.find(
      (el) => el.getAttribute("tabindex") === "0" && el.textContent?.includes("Stripe Key"),
    );
    expect(stripeRow).toBeTruthy();
    (stripeRow as HTMLElement).focus();
    await user.keyboard("{Enter}");

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

    // Edit button has aria-label="${secret.name} düzenle"
    await user.click(screen.getByRole("button", { name: /stripe key düzenle/i }));

    await waitFor(() => {
      expect(screen.getByText("Anahtarı Düzenle")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();
    });
  });

  it("atanmış proje yoksa uyari gosterir", async () => {
    mockFetchProjects.mockResolvedValueOnce([]);
    renderPage(["/projects"]);

    await waitFor(() => {
      expect(screen.getByText(/henüz size atanmış bir proje yok/i)).toBeInTheDocument();
    });
  });

  it("proje seçilmemişse kart grid gösterir", async () => {
    renderPage(["/projects"]);

    await waitFor(() => {
      expect(screen.getByText("Projeler")).toBeInTheDocument();
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
      expect(screen.getByText("3 anahtar")).toBeInTheDocument();
    });
  });

  it("kart grid'de tag badge'leri ve PROD badge'i gösterir", async () => {
    const multiProjects: ProjectSummary[] = [
      { id: "p1", name: "Apollo API", tags: ["api", "backend"], keyCount: 3, prodAccess: true },
      { id: "p2", name: "Web App", tags: [], keyCount: 0, prodAccess: false },
    ];
    mockFetchProjects.mockReset();
    mockFetchProjects.mockResolvedValue(multiProjects);
    renderPage(["/projects"]);

    await waitFor(() => {
      expect(screen.getByText("2 proje")).toBeInTheDocument();
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
      expect(screen.getByText("Web App")).toBeInTheDocument();
    });

    // Tag badges
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();

    // PROD badge only on Apollo API (prodAccess: true)
    expect(screen.getByText("PROD")).toBeInTheDocument();

    // Key counts
    expect(screen.getByText("3 anahtar")).toBeInTheDocument();
    expect(screen.getByText("0 anahtar")).toBeInTheDocument();
  });

  it("karta tıklayınca key listesine geçer", async () => {
    const user = userEvent.setup();
    renderPage(["/projects"]);

    await waitFor(() => {
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
    });

    // Click the project card
    await user.click(screen.getByText("Apollo API"));

    // Should now show key list view with env tabs
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "DEV" })).toBeInTheDocument();
    });
  });

  it("geri butonu kart grid'e döndürür", async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for key list to load
    await waitFor(() => {
      expect(screen.getByText("Apollo API")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "DEV" })).toBeInTheDocument();
    });

    // Click back button
    await user.click(screen.getByTitle("Projelere dön"));

    // Should now show card grid
    await waitFor(() => {
      expect(screen.getByText("Projeler")).toBeInTheDocument();
      expect(screen.getByText("3 anahtar")).toBeInTheDocument();
    });

    // Env tabs should no longer be visible
    expect(screen.queryByRole("tab", { name: "DEV" })).not.toBeInTheDocument();
  });
});
