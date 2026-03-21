import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { X } from "lucide-react";

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
      className={cn(
        "fixed inset-0 z-50 m-auto max-h-[85vh] w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--card-foreground)] shadow-lg backdrop:bg-black/50",
        className,
      )}
      onClick={handleBackdropClick}
      onCancel={handleCancel}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            className="rounded-sm opacity-70 ring-offset-[var(--background)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 cursor-pointer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Kapat</span>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </dialog>
  );
}
