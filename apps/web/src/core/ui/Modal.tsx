import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handleCancel = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={className ? `modal-dialog ${className}` : "modal-dialog"}
      onClick={handleBackdropClick}
      onCancel={handleCancel}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}
