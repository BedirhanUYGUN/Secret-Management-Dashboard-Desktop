import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, FileText, Upload, X } from "lucide-react";
import { commitImport, fetchProjects, previewImport, type ImportCommitResponse, type ImportPreviewResponse, type ProjectSummary } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, SecretType } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Badge } from "@core/ui/Badge";
import { Button } from "@core/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Input } from "@core/ui/Input";
import { Label } from "@core/ui/Label";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";
import { Textarea } from "@core/ui/Textarea";
import { cn } from "@core/ui/cn";

const environmentOptions: Environment[] = ["local", "dev", "prod"];
const typeOptions: SecretType[] = ["key", "token", "endpoint"];

function detectFileFormat(fileName: string): "env" | "txt" | "unknown" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".env") || lower.startsWith(".env")) return "env";
  if (lower.endsWith(".txt")) return "txt";
  return "unknown";
}

const stepLabels = [
  "Dosya Yükle",
  "Önizle",
  "Yapılandır",
  "Aktar",
];

export function ImportPage() {
  const { user } = useAuth();
  const { showToast } = useAppUi();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState<Environment>("dev");
  const [provider, setProvider] = useState("Imported");
  const [type, setType] = useState<SecretType>("key");
  const [tags, setTags] = useState("imported");
  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite">("skip");

  const [content, setContent] = useState("[Apollo API]\nSTRIPE_API_KEY=sk_live_xxx\nVERCEL_DEPLOY_HOOK=https://...");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [summary, setSummary] = useState<ImportCommitResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    void fetchProjects()
      .then((rows) => {
        setProjects(rows);
        setProjectId((current) => current || rows[0]?.id || "");
      })
      .catch((error: Error) => setErrorMessage(error.message));
  }, [user]);

  const handleFileContent = useCallback(
    (file: File) => {
      const format = detectFileFormat(file.name);
      if (format === "unknown") {
        showToast("Desteklenmeyen dosya formatı. .env veya .txt dosyası seçin.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setContent(text);
          setFileName(file.name);
          setPreview(null);
          setSummary(null);
          setErrorMessage("");
          showToast(`${file.name} dosyası yüklendi (${format.toUpperCase()})`, "success");
        }
      };
      reader.onerror = () => setErrorMessage("Dosya okunamadı.");
      reader.readAsText(file);
    },
    [showToast],
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileContent(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer.items.length > 0) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      const file = event.dataTransfer.files[0];
      if (file) handleFileContent(file);
    },
    [handleFileContent],
  );

  if (!user) return null;

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setErrorMessage("");
      setSummary(null);
      const response = await previewImport(content);
      setPreview(response);
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message || "Önizleme başarısız.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const runCommit = async () => {
    if (!projectId) {
      setErrorMessage("Proje seçimi zorunludur.");
      return;
    }
    try {
      setLoadingCommit(true);
      setErrorMessage("");
      const result = await commitImport({
        projectId,
        environment,
        content,
        provider,
        type,
        conflictStrategy,
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      });
      setSummary(result);
      showToast("İçeri aktarım işlemi tamamlandı", "success");
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message || "İçeri aktarım başarısız.");
    } finally {
      setLoadingCommit(false);
    }
  };

  const clearFile = () => {
    setFileName(null);
    setContent("");
    setPreview(null);
    setSummary(null);
  };

  const currentStep = summary ? 3 : preview ? 2 : fileName || content.trim() ? 1 : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">İçeri Aktarım Sihirbazı</h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {stepLabels.map((label, index) => (
          <div key={label} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              index <= currentStep
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]",
            )}>
              <span>{index + 1}. {label}</span>
            </div>
            {index < stepLabels.length - 1 && (
              <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adım 1: Yapılandırma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Proje</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ortam</Label>
              <Select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)}>
                {environmentOptions.map((env) => (
                  <option key={env} value={env}>
                    {env.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as SecretType)}>
                {typeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Çatışma Stratejisi</Label>
              <Select
                value={conflictStrategy}
                onChange={(e) => setConflictStrategy(e.target.value as "skip" | "overwrite")}
              >
                <option value="skip">Çatışma: Atla</option>
                <option value="overwrite">Çatışma: Üzerine Yaz</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sağlayıcı</Label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Sağlayıcı"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Etiketler</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="backend, production"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: File upload / content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adım 2: Dosya Yükle veya İçerik Yapıştır</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
              isDragging
                ? "border-[var(--primary)] bg-[var(--primary)]/5"
                : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]",
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            aria-label="Dosya yükleme alanı"
          >
            <div className={cn(
              "rounded-full p-3 transition-colors",
              isDragging ? "bg-[var(--primary)]/10" : "bg-[var(--muted)]",
            )}>
              <Upload className={cn(
                "h-6 w-6 transition-colors",
                isDragging ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {isDragging ? "Dosyayı buraya bırakın..." : "Dosyayı sürükleyip bırakın veya seçin"}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Desteklenen formatlar: .env, .txt
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".env,.txt"
              onChange={handleFileSelect}
              className="sr-only"
            />
          </div>

          {fileName && (
            <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
              <FileText className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-sm flex-1 truncate">{fileName}</span>
              <button
                type="button"
                onClick={clearFile}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                aria-label="Dosyayı temizle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>İçerik</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="KEY=value satırları veya .env dosyası içeriği..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => void loadPreview()}
              disabled={loadingPreview || !content.trim()}
              variant="outline"
            >
              {loadingPreview ? "Yükleniyor..." : "Önizle"}
            </Button>
            <Button
              onClick={() => void runCommit()}
              disabled={loadingCommit || !preview}
            >
              {loadingCommit ? "Aktarılıyor..." : "İçeri Aktar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(loadingPreview || loadingCommit) && (
        <Spinner text={loadingPreview ? "Önizleme hazırlanıyor..." : "İçeri aktarım yapılıyor..."} />
      )}

      {errorMessage && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {errorMessage}
        </div>
      )}

      {/* Preview result */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Önizleme Sonuçları
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {preview.heading && (
                <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                  <span className="text-[var(--muted-foreground)]">Başlık: </span>
                  <span className="font-medium">{preview.heading}</span>
                </div>
              )}
              <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                <span className="text-[var(--muted-foreground)]">Toplam çift: </span>
                <span className="font-medium">{preview.totalPairs}</span>
              </div>
              <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                <span className="text-[var(--muted-foreground)]">Atlanan: </span>
                <span className="font-medium">{preview.skipped}</span>
              </div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/50 p-3 space-y-1 max-h-48 overflow-y-auto">
              {preview.preview.map((item) => (
                <div key={`${item.key}-${item.value}`} className="font-mono text-xs text-[var(--foreground)]">
                  <span className="text-[var(--primary)]">{item.key}</span>
                  <span className="text-[var(--muted-foreground)]">=</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit summary */}
      {summary && (
        <Card className="border-[var(--primary)]/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
              Aktarım Tamamlandı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                <span className="text-[var(--muted-foreground)]">Eklenen: </span>
                <Badge variant="success" className="ml-1">{summary.inserted}</Badge>
              </div>
              <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                <span className="text-[var(--muted-foreground)]">Güncellenen: </span>
                <Badge variant="warning" className="ml-1">{summary.updated}</Badge>
              </div>
              <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                <span className="text-[var(--muted-foreground)]">Atlanan: </span>
                <Badge variant="secondary" className="ml-1">{summary.skipped}</Badge>
              </div>
              <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
                <span className="text-[var(--muted-foreground)]">Toplam işlenen: </span>
                <span className="font-medium">{summary.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
