import { useState } from "react";
import { exportProject, exportProjectAllEnvs } from "../api/client";
import type { Environment } from "../types";
import { useAppUi } from "./AppUiContext";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Label } from "./Label";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import { Download, Copy, AlertTriangle } from "lucide-react";

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  activeEnv: Environment;
  availableTags: string[];
};

type ExportScope = "current" | "all";
type ExportFormat = "env" | "json";

function buildFileName(projectName: string, scope: ExportScope, env: Environment, format: ExportFormat): string {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const envPart = scope === "all" ? "all" : env;
  const ext = format === "env" ? ".env" : ".json";
  return `${safeName}-${envPart}${ext}`;
}

function downloadAsFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportModal({ open, onClose, projectId, projectName, activeEnv, availableTags }: ExportModalProps) {
  const { copyWithTimer, showToast } = useAppUi();

  const [scope, setScope] = useState<ExportScope>("current");
  const [format, setFormat] = useState<ExportFormat>("env");
  const [selectedTag, setSelectedTag] = useState("all");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [prodConfirmed, setProdConfirmed] = useState(false);

  const needsProdConfirm = (scope === "current" && activeEnv === "prod") || scope === "all";

  const resetState = () => {
    setScope("current");
    setFormat("env");
    setSelectedTag("all");
    setReason("");
    setErrorMessage("");
    setProdConfirmed(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fetchExport = async (): Promise<string> => {
    const tag = selectedTag === "all" ? undefined : selectedTag;
    if (scope === "all") {
      return exportProjectAllEnvs({ projectId, format, tag, reason: reason.trim() });
    }
    return exportProject({ projectId, env: activeEnv, format, tag, reason: reason.trim() });
  };

  const handleCopyToClipboard = async () => {
    if (needsProdConfirm && !prodConfirmed) {
      setErrorMessage("Prod ortamini iceren aktarim icin onay gereklidir.");
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      const payload = await fetchExport();
      await copyWithTimer({
        value: payload,
        successMessage: `${format.toUpperCase()} disari aktarimi panoya kopyalandi`,
      });
      handleClose();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async () => {
    if (needsProdConfirm && !prodConfirmed) {
      setErrorMessage("Prod ortamini iceren aktarim icin onay gereklidir.");
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      const payload = await fetchExport();
      const fileName = buildFileName(projectName, scope, activeEnv, format);
      const mimeType = format === "env" ? "text/plain" : "application/json";
      downloadAsFile(payload, fileName, mimeType);
      showToast(`${fileName} dosyasi indirildi`, "success");
      handleClose();
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Disari Aktar">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Kapsam</Label>
          <Select value={scope} onChange={(e) => { setScope(e.target.value as ExportScope); setProdConfirmed(false); }}>
            <option value="current">Mevcut ortam ({activeEnv.toUpperCase()})</option>
            <option value="all">Tum ortamlar</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Format</Label>
          <Select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="env">.env</option>
            <option value="json">JSON</option>
          </Select>
        </div>

        {availableTags.length > 0 && (
          <div className="space-y-2">
            <Label>Etiket Filtresi</Label>
            <Select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="all">Tum etiketler</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Disari aktarma nedeni</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Orn: CI pipeline env dosyasi guncellemesi"
          />
        </div>

        {needsProdConfirm && (
          <div className="flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={prodConfirmed}
                onChange={(e) => setProdConfirmed(e.target.checked)}
                className="rounded"
              />
              Prod ortami hassas veri icerir. Disari aktarimi onayliyorum.
            </label>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => void handleCopyToClipboard()}
            disabled={loading || (needsProdConfirm && !prodConfirmed) || reason.trim().length < 3}
            size="sm"
          >
            <Copy className="h-4 w-4" />
            {loading ? "Yukleniyor..." : "Panoya Kopyala"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDownloadFile()}
            disabled={loading || (needsProdConfirm && !prodConfirmed) || reason.trim().length < 3}
            size="sm"
          >
            <Download className="h-4 w-4" />
            {loading ? "Yukleniyor..." : "Dosya Indir"}
          </Button>
          <Button variant="ghost" onClick={handleClose} size="sm">
            Iptal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
