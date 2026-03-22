import { useCallback, useEffect, useRef, useState } from "react";
import { previewImport, commitImport, type ImportPreviewResponse, type ImportCommitResponse } from "../api/client";
import type { Environment } from "../types";
import { useAppUi } from "./AppUiContext";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Label } from "./Label";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import { Badge } from "./Badge";
import { Spinner } from "./Spinner";
import { Upload } from "lucide-react";

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  activeEnv: Environment;
  onImported: () => void;
};

type ModalPhase = "input" | "result";

export function ImportModal({ open, onClose, projectId, projectName, activeEnv, onImported }: ImportModalProps) {
  const { showToast } = useAppUi();

  const [phase, setPhase] = useState<ModalPhase>("input");
  const [env, setEnv] = useState<Environment>(activeEnv);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [summary, setSummary] = useState<ImportCommitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setPhase("input");
    setEnv(activeEnv);
    setContent("");
    setPreview(null);
    setSummary(null);
    setLoading(false);
    setPreviewLoading(false);
    setErrorMessage("");
  }, [activeEnv]);

  useEffect(() => {
    if (open) resetState();
  }, [open, resetState]);

  // Debounced preview
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!content.trim()) {
      setPreview(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setErrorMessage("");
        const result = await previewImport(content);
        setPreview(result);
      } catch (err) {
        if (err instanceof Error) setErrorMessage(err.message);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setContent(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setContent(reader.result);
    };
    reader.readAsText(file);
  };

  const handleCommit = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const result = await commitImport({
        projectId,
        environment: env,
        content,
        provider: "Imported",
        type: "key",
        conflictStrategy: "skip",
        tags: ["imported"],
      });
      setSummary(result);
      setPhase("result");
      onImported();
      showToast("İçeri aktarım işlemi tamamlandı", "success");
    } catch (err) {
      if (err instanceof Error) setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (phase === "result" && summary) {
    return (
      <Modal open={open} onClose={handleClose} title="İçeri Aktarım Sonucu">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            <strong>{projectName}</strong> — {summary.environment.toUpperCase()}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{summary.inserted} eklenen</Badge>
            <Badge variant="warning">{summary.updated} güncellenen</Badge>
            <Badge variant="secondary">{summary.skipped} atlanan</Badge>
            <Badge variant="outline">{summary.total} toplam</Badge>
          </div>
          <div className="flex pt-2">
            <Button size="sm" onClick={handleClose}>Kapat</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="İçeri Aktar">
      <div className="space-y-4">
        {/* Environment selector */}
        <div className="space-y-2">
          <Label>Ortam</Label>
          <Select value={env} onChange={(e) => setEnv(e.target.value as Environment)}>
            <option value="local">LOCAL</option>
            <option value="dev">DEV</option>
            <option value="prod">PROD</option>
          </Select>
        </div>

        {/* Drop zone */}
        <div
          className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="h-5 w-5" />
          <span>Dosya sürükle veya tıklayarak seç (.env, .txt)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".env,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <Label>veya yapıştır</Label>
          <Textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"API_KEY=sk-abc123\nDB_HOST=localhost\nSECRET_TOKEN=..."}
          />
        </div>

        {/* Preview */}
        {previewLoading && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Spinner text="Önizleme yükleniyor..." />
          </div>
        )}
        {preview && !previewLoading && (
          <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline">{preview.totalPairs} çift</Badge>
              {preview.skipped > 0 && <Badge variant="warning">{preview.skipped} atlanan</Badge>}
            </div>
            <div className="max-h-32 overflow-y-auto text-xs font-mono text-[var(--muted-foreground)]">
              {preview.preview.map((pair) => (
                <div key={pair.key}>{pair.key}=***</div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => void handleCommit()}
            disabled={loading || !preview || preview.totalPairs === 0}
          >
            <Upload className="h-4 w-4" />
            {loading ? "Yükleniyor..." : "İçeri Aktar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            İptal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
