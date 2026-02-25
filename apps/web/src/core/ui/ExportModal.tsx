import { useState } from "react";
import { exportProject, exportProjectAllEnvs } from "../api/client";
import type { Environment } from "../types";
import { useAppUi } from "./AppUiContext";
import { Modal } from "./Modal";

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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [prodConfirmed, setProdConfirmed] = useState(false);

  const needsProdConfirm = (scope === "current" && activeEnv === "prod") || scope === "all";

  const resetState = () => {
    setScope("current");
    setFormat("env");
    setSelectedTag("all");
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
      return exportProjectAllEnvs({ projectId, format, tag });
    }
    return exportProject({ projectId, env: activeEnv, format, tag });
  };

  const handleCopyToClipboard = async () => {
    if (needsProdConfirm && !prodConfirmed) {
      setErrorMessage("Prod ortamını içeren aktarım için onay gereklidir.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const payload = await fetchExport();

      await copyWithTimer({
        value: payload,
        successMessage: `${format.toUpperCase()} dışarı aktarımı panoya kopyalandı`,
      });
      handleClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async () => {
    if (needsProdConfirm && !prodConfirmed) {
      setErrorMessage("Prod ortamını içeren aktarım için onay gereklidir.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const payload = await fetchExport();

      const fileName = buildFileName(projectName, scope, activeEnv, format);
      const mimeType = format === "env" ? "text/plain" : "application/json";
      downloadAsFile(payload, fileName, mimeType);

      showToast(`${fileName} dosyası indirildi`, "success");
      handleClose();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Dışarı Aktar">
      <div className="export-modal-form">
        <label className="export-modal-label">
          Kapsam
          <select value={scope} onChange={(e) => { setScope(e.target.value as ExportScope); setProdConfirmed(false); }}>
            <option value="current">Mevcut ortam ({activeEnv.toUpperCase()})</option>
            <option value="all">Tüm ortamlar</option>
          </select>
        </label>

        <label className="export-modal-label">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="env">.env</option>
            <option value="json">JSON</option>
          </select>
        </label>

        {availableTags.length > 0 && (
          <label className="export-modal-label">
            Etiket Filtresi
            <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="all">Tüm etiketler</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        )}

        {needsProdConfirm && (
          <div className="export-prod-warning">
            <label className="export-prod-confirm">
              <input
                type="checkbox"
                checked={prodConfirmed}
                onChange={(e) => setProdConfirmed(e.target.checked)}
              />
              Prod ortamı hassas veri içerir. Dışarı aktarımı onaylıyorum.
            </label>
          </div>
        )}

        {errorMessage && <p className="inline-error">{errorMessage}</p>}

        <div className="action-row export-modal-actions">
          <button
            type="button"
            onClick={() => void handleCopyToClipboard()}
            disabled={loading || (needsProdConfirm && !prodConfirmed)}
          >
            {loading ? "Yükleniyor..." : "Panoya Kopyala"}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadFile()}
            disabled={loading || (needsProdConfirm && !prodConfirmed)}
          >
            {loading ? "Yükleniyor..." : "Dosya İndir"}
          </button>
          <button type="button" onClick={handleClose}>
            İptal
          </button>
        </div>
      </div>
    </Modal>
  );
}
