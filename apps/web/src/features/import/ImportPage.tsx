import { useCallback, useEffect, useRef, useState } from "react";
import { commitImport, fetchProjects, previewImport, type ImportCommitResponse, type ImportPreviewResponse, type ProjectSummary } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, SecretType } from "@core/types";
import { useAppUi } from "@core/ui/AppUiContext";
import { Spinner } from "@core/ui/Spinner";

const environmentOptions: Environment[] = ["local", "dev", "prod"];
const typeOptions: SecretType[] = ["key", "token", "endpoint"];

/** Dosya uzantisina bakarak format algilar */
function detectFileFormat(fileName: string): "env" | "txt" | "unknown" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".env") || lower.startsWith(".env")) return "env";
  if (lower.endsWith(".txt")) return "txt";
  return "unknown";
}

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
    if (!user) {
      return;
    }

    void fetchProjects()
      .then((rows) => {
        setProjects(rows);
        setProjectId((current) => current || rows[0]?.id || "");
      })
      .catch((error: Error) => setErrorMessage(error.message));
  }, [user]);

  /** Dosya içerigini okuyup state'e yazar */
  const handleFileContent = useCallback(
    (file: File) => {
      const format = detectFileFormat(file.name);
      if (format === "unknown") {
        showToast("Desteklenmeyen dosya formati. .env veya .txt dosyası seçin.", "error");
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
      reader.onerror = () => {
        setErrorMessage("Dosya okunamadı.");
      };
      reader.readAsText(file);
    },
    [showToast],
  );

  /** Dosya seçme input handler */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileContent(file);
    }
    // Input'u sıfırla ki aynı dosya tekrar seçilebilsin
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /** Drag & drop handler'ları */
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
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
      if (file) {
        handleFileContent(file);
      }
    },
    [handleFileContent],
  );

  if (!user) {
    return null;
  }

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setErrorMessage("");
      setSummary(null);
      const response = await previewImport(content);
      setPreview(response);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Önizleme başarısız.");
      }
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
      if (error instanceof Error) {
        setErrorMessage(error.message || "İçeri aktarım başarısız.");
      }
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

  return (
    <section className="page-panel">
      <h2>İçeri Aktarım Sihirbazı</h2>
      <ol>
        <li>Dosya yükleyin, sürükleyip bırakın veya içerik yapıştırın.</li>
        <li>Ayrıştırılan proje başlıkları ve KEY=value satırlarını önizleyin.</li>
        <li>Proje/ortam ve çatışma stratejisini seçin.</li>
        <li>İçeri aktarımı onaylayın ve özeti inceleyin.</li>
      </ol>

      <div className="filter-row filter-row-wrap">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select value={environment} onChange={(event) => setEnvironment(event.target.value as Environment)}>
          {environmentOptions.map((env) => (
            <option key={env} value={env}>
              {env.toUpperCase()}
            </option>
          ))}
        </select>

        <select value={type} onChange={(event) => setType(event.target.value as SecretType)}>
          {typeOptions.map((item) => (
            <option key={item} value={item}>
              {item.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          value={conflictStrategy}
          onChange={(event) => setConflictStrategy(event.target.value as "skip" | "overwrite")}
        >
          <option value="skip">Çatışma: Atla</option>
          <option value="overwrite">Çatışma: Üzerine Yaz</option>
        </select>

        <input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Sağlayıcı" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="etiket1, etiket2" />
      </div>

      {/* Dosya yükleme ve sürükle-bırak alanı */}
      <div
        className={`import-dropzone import-upload-zone${isDragging ? " import-drag-active" : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="import-upload-content">
          <p className="import-upload-title">
            {isDragging ? "Dosyayı buraya bırakın..." : "Dosyayı sürükleyip bırakın veya seçin"}
          </p>
          <p className="import-upload-hint">Desteklenen formatlar: .env, .txt</p>
          <div className="action-row">
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Dosya Seç
            </button>
            {fileName && (
              <button type="button" onClick={clearFile}>
                Temizle
              </button>
            )}
          </div>
          {fileName && <p className="import-file-name">Yüklenen: <strong>{fileName}</strong></p>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".env,.txt"
          onChange={handleFileSelect}
          className="import-file-input"
        />
      </div>

      <textarea className="import-textarea" value={content} onChange={(event) => setContent(event.target.value)} rows={10} />

      <div className="action-row">
        <button type="button" onClick={() => void loadPreview()} disabled={loadingPreview}>
          {loadingPreview ? "Yükleniyor..." : "Önizleme"}
        </button>
        <button type="button" onClick={() => void runCommit()} disabled={loadingCommit || !preview}>
          {loadingCommit ? "Aktarılıyor..." : "İçeri Aktar"}
        </button>
      </div>

      {(loadingPreview || loadingCommit) && <Spinner text={loadingPreview ? "Önizleme hazırlanıyor..." : "İçeri aktarım yapılıyor..."} />}
      {errorMessage && <p className="inline-error">{errorMessage}</p>}

      {preview && (
        <div className="import-dropzone">
          <div>
            <p>
              Başlık: <strong>{preview.heading ?? "Yok"}</strong>
            </p>
            <p>
              Toplam çift: <strong>{preview.totalPairs}</strong>
            </p>
            <p>
              Atlanan satırlar: <strong>{preview.skipped}</strong>
            </p>
            <ul>
              {preview.preview.map((item) => (
                <li key={`${item.key}-${item.value}`}>
                  <code>
                    {item.key}={item.value}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {summary && (
        <div className="import-dropzone">
          <div>
            <p>
              Eklenen: <strong>{summary.inserted}</strong>
            </p>
            <p>
              Güncellenen: <strong>{summary.updated}</strong>
            </p>
            <p>
              Atlanan: <strong>{summary.skipped}</strong>
            </p>
            <p>
              Toplam işlenen: <strong>{summary.total}</strong>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
