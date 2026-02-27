import { useAppUi } from "./AppUiContext";
import { Modal } from "./Modal";

export function ToastViewport() {
  const { toast, confirmDialog, dismissConfirm } = useAppUi();

  return (
    <>
      <div role="status" aria-live="polite">
        {toast && <div className={`toast toast-${toast.tone}`}>{toast.message}</div>}
      </div>

      <Modal
        open={confirmDialog !== null}
        onClose={() => dismissConfirm(false)}
        title={confirmDialog?.title ?? ""}
      >
        {confirmDialog && (
          <>
            <p className="confirm-dialog-message">{confirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button type="button" onClick={() => dismissConfirm(false)}>
                {confirmDialog.cancelLabel ?? "Vazgec"}
              </button>
              <button
                type="button"
                className={confirmDialog.variant === "danger" ? "btn-danger" : "btn-primary"}
                onClick={() => dismissConfirm(true)}
              >
                {confirmDialog.confirmLabel ?? "Onayla"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
