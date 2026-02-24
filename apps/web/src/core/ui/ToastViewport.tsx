import { useAppUi } from "./AppUiContext";

export function ToastViewport() {
  const { toast } = useAppUi();

  if (!toast) {
    return null;
  }

  return <div className={`toast toast-${toast.tone}`}>{toast.message}</div>;
}
