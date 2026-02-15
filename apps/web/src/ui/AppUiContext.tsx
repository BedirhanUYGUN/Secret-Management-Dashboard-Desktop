import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
};

type AppUiContextValue = {
  clipboardSeconds: number;
  setClipboardSeconds: (value: number) => void;
  toast: Toast | null;
  showToast: (message: string, tone?: Toast["tone"]) => void;
  copyWithTimer: (params: {
    value: string;
    successMessage: string;
    onCopied?: () => Promise<void> | void;
  }) => Promise<void>;
};

const AppUiContext = createContext<AppUiContextValue | undefined>(undefined);
const CLIPBOARD_KEY = "api-key-organizer-clipboard-seconds";

export function AppUiProvider({ children }: { children: ReactNode }) {
  const [clipboardSeconds, setClipboardSecondsState] = useState<number>(() => {
    const raw = localStorage.getItem(CLIPBOARD_KEY);
    const parsed = raw ? Number(raw) : 30;
    if (Number.isNaN(parsed) || parsed < 5 || parsed > 300) {
      return 30;
    }
    return parsed;
  });
  const [toast, setToast] = useState<Toast | null>(null);

  const hideTimerRef = useRef<number | null>(null);
  const clearClipboardTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(CLIPBOARD_KEY, String(clipboardSeconds));
  }, [clipboardSeconds]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      if (clearClipboardTimerRef.current !== null) {
        window.clearTimeout(clearClipboardTimerRef.current);
      }
    };
  }, []);

  const value = useMemo<AppUiContextValue>(
    () => ({
      clipboardSeconds,
      setClipboardSeconds: (nextValue: number) => {
        const bounded = Math.max(5, Math.min(300, Math.floor(nextValue || 30)));
        setClipboardSecondsState(bounded);
      },
      toast,
      showToast: (message: string, tone: Toast["tone"] = "info") => {
        setToast({ id: Date.now(), message, tone });
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = window.setTimeout(() => setToast(null), 2600);
      },
      copyWithTimer: async ({ value: text, successMessage, onCopied }) => {
        await navigator.clipboard.writeText(text);
        if (onCopied) {
          await onCopied();
        }
        setToast({ id: Date.now(), message: successMessage, tone: "success" });
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = window.setTimeout(() => setToast(null), 2600);

        if (clearClipboardTimerRef.current !== null) {
          window.clearTimeout(clearClipboardTimerRef.current);
        }
        clearClipboardTimerRef.current = window.setTimeout(() => {
          void navigator.clipboard.writeText("").catch(() => undefined);
        }, clipboardSeconds * 1000);
      },
    }),
    [clipboardSeconds, toast],
  );

  return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>;
}

export function useAppUi() {
  const context = useContext(AppUiContext);
  if (!context) {
    throw new Error("useAppUi must be used within AppUiProvider");
  }
  return context;
}
