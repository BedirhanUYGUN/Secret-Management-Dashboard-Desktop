import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Filter,
  History,
  Key,
  MoreVertical,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  ChevronUp,
  ChevronDown,
  FolderOpen,
  Braces,
  Terminal,
  Upload,
} from "lucide-react";
import {
  createProjectSecret,
  deleteProjectSecret,
  fetchSecretVersions,
  fetchProjectSecrets,
  fetchProjects,
  revealSecretValue,
  restoreSecretVersion,
  trackCopyEvent,
  type ProjectSummary,
  updateProjectSecret,
} from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, Secret, SecretType, SecretVersion } from "@core/types";
import { ExportModal } from "@core/ui/ExportModal";
import { ImportModal } from "@core/ui/ImportModal";
import { useAppUi } from "@core/ui/AppUiContext";
import { Modal } from "@core/ui/Modal";
import { Spinner } from "@core/ui/Spinner";
import { Button } from "@core/ui/Button";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Textarea } from "@core/ui/Textarea";
import { Select } from "@core/ui/Select";
import { Badge } from "@core/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@core/ui/Card";
import { Tabs, TabsList, TabsTrigger } from "@core/ui/Tabs";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@core/ui/DropdownMenu";
import { cn } from "@core/ui/cn";

const envTabs: Environment[] = ["local", "dev", "prod"];
const defaultTypeOptions = ["key", "token", "endpoint", "url", "credential", "certificate"];

type SortKey = "name" | "provider" | "type" | "environment" | "updatedAt";
type SortDir = "asc" | "desc";
type SecretModalMode = "detail" | "edit";

function toEnvironment(value: string | null): Environment | null {
  if (value === "local" || value === "dev" || value === "prod") {
    return value;
  }
  return null;
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function envBadgeVariant(env: Environment): "default" | "warning" | "destructive" | "secondary" {
  if (env === "prod") return "destructive";
  if (env === "dev") return "warning";
  return "secondary";
}

function typeBadgeVariant(type: SecretType): "default" | "secondary" | "outline" {
  if (type === "token") return "default";
  if (type === "endpoint") return "outline";
  return "secondary";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <ChevronDown className="ml-1 h-3 w-3 opacity-30" />;
  }
  return dir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3 text-[var(--primary)]" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3 text-[var(--primary)]" />
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={cn(
        "flex items-center text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors",
        isActive
          ? "text-[var(--primary)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {label}
      <SortIcon active={isActive} dir={sortDir} />
    </button>
  );
}

type SecretFormState = {
  name: string;
  provider: string;
  type: SecretType;
  keyName: string;
  value: string;
  tags: string;
  notes: string;
};

const emptyForm: SecretFormState = {
  name: "",
  provider: "",
  type: "key",
  keyName: "",
  value: "",
  tags: "",
  notes: "",
};

function SecretFormFields({
  form,
  onChange,
  isEdit,
}: {
  form: SecretFormState;
  onChange: (updates: Partial<SecretFormState>) => void;
  isEdit?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-name">Anahtar Adı</Label>
          <Input
            id="field-name"
            placeholder="Örn: Stripe API Key"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-provider">Servis Sağlayıcı</Label>
          <Input
            id="field-provider"
            placeholder="Örn: AWS, Stripe"
            value={form.provider}
            onChange={(e) => onChange({ provider: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="field-type">Tip</Label>
        <Input
          id="field-type"
          list="secret-type-options"
          placeholder="Örn: key, token, url"
          value={form.type}
          onChange={(e) => onChange({ type: e.target.value })}
        />
        <datalist id="secret-type-options">
          {defaultTypeOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      <div className="border-t border-[var(--border)] pt-4 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-keyname">Ortam Değişken Adı</Label>
          <Input
            id="field-keyname"
            placeholder="Örn: STRIPE_SECRET_KEY"
            value={form.keyName}
            onChange={(e) => onChange({ keyName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-value">
            {isEdit ? "Yeni Gizli Değer" : "Gizli Anahtar Değeri"}
          </Label>
          <Input
            id="field-value"
            type="password"
            placeholder={isEdit ? "Boş bırakırsanız mevcut değer korunur" : "Gizli anahtar değeri"}
            value={form.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-4 grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-tags">
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Etiketler
            </span>
          </Label>
          <Input
            id="field-tags"
            placeholder="Virgülle ayırın: backend, production"
            value={form.tags}
            onChange={(e) => onChange({ tags: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-notes">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Notlar
            </span>
          </Label>
          <Textarea
            id="field-notes"
            placeholder="Ek notlar (isteğe bağlı)"
            rows={3}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Copy format card ─────────────────────────────────────────────────────────

function CopyFormatCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--accent)] cursor-pointer"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-semibold text-[var(--foreground)]">{title}</span>
      <span className="text-[10px] text-[var(--muted-foreground)]">{subtitle}</span>
    </button>
  );
}

// ─── Project cards grid (landing view) ─────────────────────────────────────────

function ProjectCardsGrid({
  projects,
  onSelect,
}: {
  projects: ProjectSummary[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Projeler</h1>
        <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
          {projects.length} proje
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="cursor-pointer transition-colors hover:border-[var(--primary)]/50"
            onClick={() => onSelect(project.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{project.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Key className="h-3.5 w-3.5" />
                <span>{project.keyCount} anahtar</span>
              </div>
              {project.prodAccess && (
                <Badge variant="outline" className="w-fit text-xs">PROD</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const { user } = useAuth();
  const { copyWithTimer, showToast, confirm } = useAppUi();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryProject = searchParams.get("project");
  const querySecret = searchParams.get("secret");
  const queryEnv = toEnvironment(searchParams.get("env"));

  const [activeEnv, setActiveEnv] = useState<Environment>(queryEnv ?? "dev");
  const [snippetFormat, setSnippetFormat] = useState<"json" | "python" | "node">("json");
  const [selectedSecretId, setSelectedSecretId] = useState<string>(querySecret ?? "");

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [visibleSecrets, setVisibleSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [providerFilter, setProviderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<SecretFormState>(emptyForm);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretModalMode, setSecretModalMode] = useState<SecretModalMode>("detail");

  const [editForm, setEditForm] = useState<SecretFormState>(emptyForm);

  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showPlainValue, setShowPlainValue] = useState(false);
  const [revealReason, setRevealReason] = useState("");
  const [secretVersions, setSecretVersions] = useState<SecretVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  useEffect(() => {
    if (!user) return;
    void fetchProjects()
      .then((rows) => setProjects(rows))
      .catch((error: Error) => {
        setErrorMessage(error.message || "Projeler yüklenemedi.");
      });
  }, [user]);

  useEffect(() => {
    if (queryEnv) setActiveEnv(queryEnv);
  }, [queryEnv]);

  const activeProject = queryProject
    ? (projects.find((p) => p.id === queryProject) ?? null)
    : null;
  const canAccessProd = activeProject?.prodAccess ?? false;

  useEffect(() => {
    if (activeEnv === "prod" && !canAccessProd) {
      setActiveEnv("dev");
      updateQuery({ env: "dev", secret: null });
    }
  }, [activeEnv, canAccessProd]);

  const reloadSecrets = async () => {
    if (!user || !activeProject) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchProjectSecrets({
        projectId: activeProject.id,
        env: activeEnv,
        provider: providerFilter === "all" ? undefined : providerFilter,
        tag: tagFilter === "all" ? undefined : tagFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setVisibleSecrets(rows);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message || "Anahtarlar yüklenemedi.");
      setVisibleSecrets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadSecrets();
  }, [activeEnv, activeProject, providerFilter, tagFilter, typeFilter, user]);

  useEffect(() => {
    if (!querySecret) return;
    setSelectedSecretId(querySecret);
  }, [querySecret]);

  const selectedSecret = useMemo(
    () => visibleSecrets.find((item) => item.id === selectedSecretId) ?? null,
    [selectedSecretId, visibleSecrets],
  );

  useEffect(() => {
    if (!selectedSecret) {
      setSecretVersions([]);
      return;
    }
    setEditForm({
      name: selectedSecret.name,
      provider: selectedSecret.provider,
      type: selectedSecret.type,
      keyName: selectedSecret.keyName,
      value: "",
      tags: selectedSecret.tags.join(", "),
      notes: selectedSecret.notes,
    });
    setRevealedValue(null);
    setShowPlainValue(false);
    setRevealReason("");
  }, [selectedSecret]);

  useEffect(() => {
    if (!selectedSecret || !showSecretModal) return;
    void (async () => {
      try {
        setLoadingVersions(true);
        const versions = await fetchSecretVersions(selectedSecret.id);
        setSecretVersions(versions);
      } catch (error) {
        if (error instanceof Error) setErrorMessage(error.message);
        setSecretVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    })();
  }, [selectedSecret, showSecretModal]);

  const sortedSecrets = useMemo(() => {
    return [...visibleSecrets].sort((a, b) => {
      if (sortKey === "updatedAt") {
        const result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        return sortDir === "asc" ? result : -result;
      }
      const result = a[sortKey].localeCompare(b[sortKey], "tr");
      return sortDir === "asc" ? result : -result;
    });
  }, [visibleSecrets, sortDir, sortKey]);

  const providers = useMemo(
    () => Array.from(new Set(visibleSecrets.map((item) => item.provider))),
    [visibleSecrets],
  );
  const tags = useMemo(
    () => Array.from(new Set(visibleSecrets.flatMap((item) => item.tags))),
    [visibleSecrets],
  );
  const secretTypes = useMemo(
    () => Array.from(new Set([...defaultTypeOptions, ...visibleSecrets.map((s) => s.type)])).sort(),
    [visibleSecrets],
  );

  const readSecretValue = async (secretId: string, reason: string) => {
    const revealed = await revealSecretValue({ secretId, reason });
    return revealed.value;
  };

  const copySecret = async (secret: Secret, mode: "value" | "env" | "json" | "python" | "node") => {
    if (!user) return;
    try {
      const isAdmin = user?.role === "admin";
      let reason: string;
      if (isAdmin) {
        reason = "Admin erişimi";
      } else {
        const prompted = window.prompt(
          "Bu anahtarı neden görüntülemek/kopyalamak istediğinizi kısaca yazın:",
          "Lokal geliştirme doğrulaması",
        );
        if (!prompted || prompted.trim().length < 3) return;
        reason = prompted.trim();
      }

      const value = await readSecretValue(secret.id, reason);
      let payload = value;
      if (mode === "env") payload = `${secret.keyName}=${value}`;
      if (mode === "json") payload = JSON.stringify({ [secret.keyName]: value }, null, 2);
      if (mode === "python") payload = `${secret.keyName} = "${value}"`;
      if (mode === "node") payload = `process.env.${secret.keyName} = "${value}";`;

      await copyWithTimer({
        value: payload,
        successMessage: `${secret.keyName} panoya kopyalandı`,
        onCopied: async () => {
          await trackCopyEvent({ projectId: secret.projectId, secretId: secret.id });
        },
      });
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const toggleReveal = async () => {
    if (!selectedSecret) return;
    if (showPlainValue) {
      setShowPlainValue(false);
      return;
    }
    setIsRevealing(true);
    try {
      const isAdmin = user?.role === "admin";
      const reason = isAdmin ? (revealReason.trim() || "Admin erişimi") : revealReason.trim();
      if (!isAdmin && reason.length < 3) {
        setErrorMessage("Anahtarı görüntülemek için neden alanını doldurun.");
        return;
      }
      const value = await readSecretValue(selectedSecret.id, reason);
      setRevealedValue(value);
      setShowPlainValue(true);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    } finally {
      setIsRevealing(false);
    }
  };

  const submitCreate = async () => {
    if (!user || !activeProject) return;
    try {
      await createProjectSecret({
        projectId: activeProject.id,
        payload: {
          name: createForm.name,
          provider: createForm.provider,
          type: createForm.type,
          environment: activeEnv,
          keyName: createForm.keyName,
          value: createForm.value,
          tags: parseTags(createForm.tags),
          notes: createForm.notes,
        },
      });
      setShowCreateForm(false);
      setCreateForm(emptyForm);
      showToast("Anahtar oluşturuldu", "success");
      await reloadSecrets();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const submitEdit = async () => {
    if (!user || !selectedSecret) return;
    try {
      await updateProjectSecret({
        secretId: selectedSecret.id,
        payload: {
          name: editForm.name,
          provider: editForm.provider,
          type: editForm.type,
          keyName: editForm.keyName,
          value: editForm.value || undefined,
          tags: parseTags(editForm.tags),
          notes: editForm.notes,
        },
      });
      setSecretModalMode("detail");
      showToast("Anahtar güncellendi", "success");
      await reloadSecrets();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const removeSecret = async () => {
    if (!user || !selectedSecret) return;
    const approved = await confirm({
      title: "Anahtarı Sil",
      message: "Bu anahtar silinsin mi? Bu işlem geri alınamaz.",
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) return;
    try {
      await deleteProjectSecret({ secretId: selectedSecret.id });
      showToast("Anahtar silindi", "success");
      setShowSecretModal(false);
      setSelectedSecretId("");
      updateQuery({ secret: null });
      await reloadSecrets();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!selectedSecret) return;
    const approved = await confirm({
      title: "Sürümü Geri Yükle",
      message: `v${version} sürümüne geri dönülsün mü? Mevcut değer yeni bir sürüm olarak saklanacaktır.`,
      confirmLabel: "Geri Yükle",
      cancelLabel: "Vazgeç",
      variant: "danger",
    });
    if (!approved) return;
    try {
      const restored = await restoreSecretVersion({ secretId: selectedSecret.id, version });
      setSelectedSecretId(restored.id);
      showToast(`v${version} geri yüklendi`, "success");
      await reloadSecrets();
      const versions = await fetchSecretVersions(restored.id);
      setSecretVersions(versions);
      setSecretModalMode("detail");
      setShowPlainValue(false);
      setRevealedValue(null);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    }
  };

  const handleRowSelect = (secret: Secret) => {
    if (!activeProject) return;
    setSelectedSecretId(secret.id);
    updateQuery({ project: activeProject.id, env: activeEnv, secret: secret.id });
  };

  const openSecretModal = (secret: Secret, mode: SecretModalMode) => {
    handleRowSelect(secret);
    setSecretModalMode(mode);
    setShowSecretModal(true);
  };

  const closeSecretModal = () => {
    setShowSecretModal(false);
    setSecretModalMode("detail");
    setShowPlainValue(false);
  };

  if (!user) return null;

  // ─── Empty state (no project) ───────────────────────────────────────────────
  if (!activeProject) {
    if (projects.length === 0) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
              <FolderOpen className="h-8 w-8 text-[var(--muted-foreground)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                Atanmış proje bulunmuyor
              </h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Henüz size atanmış bir proje yok. Yöneticinizden proje ataması talep edin.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <ProjectCardsGrid
        projects={projects}
        onSelect={(id) => updateQuery({ project: id })}
      />
    );
  }

  const isViewer = user.role === "viewer";

  // ─── Snippet preview text ───────────────────────────────────────────────────
  const snippetText = selectedSecret
    ? snippetFormat === "json"
      ? `{"${selectedSecret.keyName}": "${selectedSecret.valueMasked}"}`
      : snippetFormat === "python"
        ? `${selectedSecret.keyName} = "${selectedSecret.valueMasked}"`
        : `process.env.${selectedSecret.keyName} = "${selectedSecret.valueMasked}";`
    : "";

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updateQuery({ project: null, env: null, secret: null })}
            title="Projelere dön"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">{activeProject.name}</h1>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {visibleSecrets.length} anahtar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            disabled={isViewer}
          >
            <Upload className="h-4 w-4" />
            İçeri Aktar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportModal(true)}
            disabled={isViewer}
          >
            <Download className="h-4 w-4" />
            Dışarı Aktar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
            disabled={isViewer}
          >
            <Plus className="h-4 w-4" />
            Anahtar Ekle
          </Button>
        </div>
      </div>

      {/* Environment tabs */}
      <Tabs value={activeEnv} onValueChange={(v) => {
        const env = v as Environment;
        setActiveEnv(env);
        updateQuery({ env, secret: null });
      }}>
        <TabsList className="gap-1">
          {envTabs.map((env) => {
            const restricted = env === "prod" && !canAccessProd;
            return (
              <TabsTrigger
                key={env}
                value={env}
                className={cn(restricted && "pointer-events-none opacity-40")}
              >
                {env.toUpperCase()}
                {restricted && (
                  <span className="ml-1.5 text-[10px] text-[var(--muted-foreground)]">(kısıtlı)</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Create form */}
      {showCreateForm && (
        <Card className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Yeni Anahtar Oluştur</CardTitle>
            <CardDescription>
              Projeye yeni bir API anahtarı, token veya endpoint ekleyin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <SecretFormFields
              form={createForm}
              onChange={(updates) => setCreateForm((prev) => ({ ...prev, ...updates }))}
            />
            <div className="mt-6 flex items-center gap-2">
              <Button onClick={() => void submitCreate()}>Oluştur</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                İptal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
        <Select
          className="w-44"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          <option value="all">Tüm sağlayıcılar</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">Tüm etiketler</option>
          {tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Select
          className="w-36"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">Tüm tipler</option>
          {secretTypes.map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </Select>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {errorMessage}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <Spinner text="Anahtarlar yükleniyor..." variant="skeleton-table" />}

      {/* Secrets table */}
      {!loading && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr_1.4fr_1.2fr_auto_auto] gap-4 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2.5">
            <SortableHeader label="Ad" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortableHeader label="Sağlayıcı" sortKey="provider" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortableHeader label="Tip" sortKey="type" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortableHeader label="Ortam" sortKey="environment" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Maskeli Değer
            </span>
            <SortableHeader label="Güncelleme" sortKey="updatedAt" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <span className="sr-only">Düzenle</span>
            <span className="sr-only">İşlemler</span>
          </div>

          {/* Rows */}
          {sortedSecrets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)]">
                <Key className="h-6 w-6 text-[var(--muted-foreground)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Bu ortamda anahtar bulunmuyor
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Yeni bir anahtar ekleyerek başlayabilirsiniz.
                </p>
              </div>
            </div>
          ) : (
            sortedSecrets.map((secret, idx) => {
              const isSelected = secret.id === selectedSecret?.id;
              return (
                <div
                  key={secret.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowSelect(secret)}
                  onDoubleClick={() => openSecretModal(secret, "detail")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openSecretModal(secret, "detail");
                  }}
                  className={cn(
                    "grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr_1.4fr_1.2fr_auto_auto] items-center gap-4 px-4 py-3 text-sm transition-colors cursor-pointer outline-none",
                    idx !== sortedSecrets.length - 1 && "border-b border-[var(--border)]",
                    isSelected
                      ? "bg-[var(--primary)]/8 ring-inset ring-1 ring-[var(--primary)]/30"
                      : "hover:bg-[var(--accent)]",
                    "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset",
                  )}
                >
                  {/* Name */}
                  <span className="truncate font-medium text-[var(--foreground)]">
                    {secret.name}
                  </span>

                  {/* Provider */}
                  <span className="truncate text-[var(--muted-foreground)]">
                    {secret.provider}
                  </span>

                  {/* Type */}
                  <Badge variant={typeBadgeVariant(secret.type)} className="w-fit text-[10px]">
                    {secret.type.toUpperCase()}
                  </Badge>

                  {/* Environment */}
                  <Badge variant={envBadgeVariant(secret.environment)} className="w-fit text-[10px]">
                    {secret.environment.toUpperCase()}
                  </Badge>

                  {/* Masked value */}
                  <code className="truncate rounded bg-[var(--muted)] px-2 py-0.5 font-mono text-xs text-[var(--muted-foreground)]">
                    {secret.valueMasked}
                  </code>

                  {/* Updated at */}
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {new Date(secret.updatedAt).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {/* Edit button */}
                  {!isViewer && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${secret.name} düzenle`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openSecretModal(secret, "edit");
                      }}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Actions dropdown */}
                  <DropdownMenu
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Daha fazla işlem"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    }
                    align="end"
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        openSecretModal(secret, "detail");
                      }}
                    >
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      Detayları Görüntüle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void copySecret(secret, "value");
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Değeri Kopyala
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void copySecret(secret, "env");
                      }}
                    >
                      <Terminal className="mr-2 h-3.5 w-3.5" />
                      ENV Formatında Kopyala
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void copySecret(secret, "json");
                      }}
                    >
                      <Braces className="mr-2 h-3.5 w-3.5" />
                      JSON Olarak Kopyala
                    </DropdownMenuItem>
                    {!isViewer && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowSelect(secret);
                            void removeSecret();
                          }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Sil
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Secret detail/edit modal */}
      <Modal
        open={showSecretModal && selectedSecret !== null}
        onClose={closeSecretModal}
        title={secretModalMode === "edit" ? "Anahtarı Düzenle" : "Anahtar Detayları"}
        className="max-w-2xl"
      >
        {selectedSecret && (
          <div className="flex flex-col gap-5 overflow-y-auto max-h-[calc(85vh-5rem)]">
            {secretModalMode === "detail" ? (
              <>
                {/* Detail header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                      {selectedSecret.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {selectedSecret.provider}
                      </Badge>
                      <Badge variant={typeBadgeVariant(selectedSecret.type)} className="text-[10px]">
                        {selectedSecret.type.toUpperCase()}
                      </Badge>
                      <Badge variant={envBadgeVariant(selectedSecret.environment)} className="text-[10px]">
                        {selectedSecret.environment.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  {!isViewer && (
                    <Button size="sm" variant="outline" onClick={() => setSecretModalMode("edit")}>
                      <Edit2 className="h-3.5 w-3.5" />
                      Düzenle
                    </Button>
                  )}
                </div>

                {/* Reveal section */}
                <Card>
                  <CardHeader className="py-4 pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Key className="h-4 w-4 text-[var(--primary)]" />
                      Değer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col gap-3">
                    {user?.role !== "admin" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reveal-reason">Görüntüleme nedeni</Label>
                        <Textarea
                          id="reveal-reason"
                          rows={2}
                          value={revealReason}
                          onChange={(e) => setRevealReason(e.target.value)}
                          placeholder="Örn: Prod doğrulaması için değeri kontrol ediyorum"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                      <code className="flex-1 font-mono text-sm text-[var(--foreground)] break-all">
                        {showPlainValue && revealedValue ? revealedValue : "••••••••••••••••"}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void toggleReveal()}
                        disabled={isRevealing}
                      >
                        {isRevealing ? (
                          "Yükleniyor..."
                        ) : showPlainValue ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Gizle
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Göster
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Copy formats */}
                <Card>
                  <CardHeader className="py-4 pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Copy className="h-4 w-4 text-[var(--primary)]" />
                      Kopyalama Formatı
                    </CardTitle>
                    <CardDescription>
                      Anahtarı farklı formatlarda panoya kopyalayın.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col gap-4">
                    <div className="grid grid-cols-5 gap-2">
                      <CopyFormatCard
                        icon={<Copy className="h-4 w-4" />}
                        title="Düz Değer"
                        subtitle="Ham değer"
                        onClick={() => void copySecret(selectedSecret, "value")}
                      />
                      <CopyFormatCard
                        icon={<Terminal className="h-4 w-4" />}
                        title="ENV"
                        subtitle="KEY=value"
                        onClick={() => void copySecret(selectedSecret, "env")}
                      />
                      <CopyFormatCard
                        icon={<Braces className="h-4 w-4" />}
                        title="JSON"
                        subtitle="Nesne"
                        onClick={() => void copySecret(selectedSecret, "json")}
                      />
                      <CopyFormatCard
                        icon={<span className="text-sm">🐍</span>}
                        title="Python"
                        subtitle="Değişken"
                        onClick={() => void copySecret(selectedSecret, "python")}
                      />
                      <CopyFormatCard
                        icon={<span className="text-sm">🟢</span>}
                        title="Node.js"
                        subtitle="process.env"
                        onClick={() => void copySecret(selectedSecret, "node")}
                      />
                    </div>

                    {/* Snippet preview */}
                    <div className="rounded-md border border-[var(--border)] overflow-hidden">
                      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)] px-3 py-1.5">
                        <div className="flex gap-1">
                          {(["json", "python", "node"] as const).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setSnippetFormat(fmt)}
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                                snippetFormat === fmt
                                  ? "bg-[var(--primary)] text-white"
                                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                              )}
                            >
                              {fmt === "node" ? "Node.js" : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-[var(--muted-foreground)]">önizleme</span>
                      </div>
                      <pre className="overflow-x-auto px-3 py-3 font-mono text-xs text-[var(--foreground)] bg-[var(--background)]">
                        {snippetText}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                {/* Metadata */}
                <Card>
                  <CardHeader className="py-4 pb-3">
                    <CardTitle className="text-sm">Detaylar</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-[var(--muted-foreground)]">Son Güncelleyen</span>
                        <span className="text-sm font-medium">
                          {selectedSecret.updatedByName || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-[var(--muted-foreground)]">Son Kopyalanma</span>
                        <span className="text-sm font-medium">
                          {selectedSecret.lastCopiedAt
                            ? new Date(selectedSecret.lastCopiedAt).toLocaleString("tr-TR")
                            : "-"}
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        Etiketler
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSecret.tags.length > 0 ? (
                          selectedSecret.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">—</span>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Notlar
                      </span>
                      <p className="text-sm text-[var(--foreground)]">
                        {selectedSecret.notes || "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Version history */}
                <Card>
                  <CardHeader className="py-4 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4 text-[var(--primary)]" />
                        Sürüm Geçmişi
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        Mevcut: v{selectedSecret.version}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {loadingVersions && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Sürüm geçmişi yükleniyor...
                      </p>
                    )}
                    {!loadingVersions && secretVersions.length === 0 && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Henüz geçmiş sürüm bulunmuyor.
                      </p>
                    )}
                    <div className="flex flex-col divide-y divide-[var(--border)]">
                      {secretVersions.map((ver) => (
                        <div
                          key={ver.version}
                          className="flex items-start justify-between gap-4 py-3"
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[var(--foreground)]">
                                v{ver.version}
                              </span>
                              {ver.isCurrent && (
                                <Badge variant="success" className="text-[10px]">aktif</Badge>
                              )}
                            </div>
                            <code className="font-mono text-xs text-[var(--muted-foreground)]">
                              {ver.maskedValue}
                            </code>
                            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                              <span>{new Date(ver.createdAt).toLocaleString("tr-TR")}</span>
                              <span>•</span>
                              <span>{ver.createdByName || "Bilinmiyor"}</span>
                            </div>
                          </div>
                          {!ver.isCurrent && !isViewer && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleRestoreVersion(ver.version)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Geri Yükle
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Edit mode */
              <div className="flex flex-col gap-5">
                <SecretFormFields
                  form={editForm}
                  onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
                  isEdit
                />
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4">
                  <Button onClick={() => void submitEdit()}>Kaydet</Button>
                  <Button variant="outline" onClick={() => setSecretModalMode("detail")}>
                    Vazgeç
                  </Button>
                  {user.role === "admin" && (
                    <Button
                      variant="destructive"
                      className="ml-auto"
                      onClick={() => void removeSecret()}
                    >
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Export modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        projectId={activeProject.id}
        projectName={activeProject.name}
        activeEnv={activeEnv}
        availableTags={tags}
      />

      {/* Import modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={activeProject.id}
        projectName={activeProject.name}
        activeEnv={activeEnv}
        onImported={() => void reloadSecrets()}
      />
    </div>
  );
}
