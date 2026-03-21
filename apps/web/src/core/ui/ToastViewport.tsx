import { useAppUi } from "./AppUiContext";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { CheckCircle2, XCircle, Info } from "lucide-react";

const toneConfig = {
  success: { icon: CheckCircle2, bg: "bg-brand-500/15", border: "border-brand-500/30", text: "text-brand-400" },
  error: { icon: XCircle, bg: "bg-danger-500/15", border: "border-danger-500/30", text: "text-danger-400" },
  info: { icon: Info, bg: "bg-[var(--secondary)]", border: "border-[var(--border)]", text: "text-[var(--foreground)]" },
};

export function ToastViewport() {
  const { toast, confirmDialog, dismissConfirm } = useAppUi();

  return (
    <>
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[100]">
        {toast && (() => {
          const config = toneConfig[toast.tone];
          const Icon = config.icon;
          return (
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${config.bg} ${config.border} ${config.text}`}
              style={{ animation: "toast-slide-in 0.3s ease" }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {toast.message}
            </div>
          );
        })()}
      </div>

      <Modal
        open={confirmDialog !== null}
        onClose={() => dismissConfirm(false)}
        title={confirmDialog?.title ?? ""}
      >
        {confirmDialog && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => dismissConfirm(false)}>
                {confirmDialog.cancelLabel ?? "Vazgec"}
              </Button>
              <Button
                variant={confirmDialog.variant === "danger" ? "destructive" : "default"}
                onClick={() => dismissConfirm(true)}
              >
                {confirmDialog.confirmLabel ?? "Onayla"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
