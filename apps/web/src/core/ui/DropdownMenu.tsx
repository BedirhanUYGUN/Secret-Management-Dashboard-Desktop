import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "./cn";

function DropdownMenu({ trigger, children, align = "end" }: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] shadow-md animate-in fade-in-0 zoom-in-95",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

function DropdownMenuItem({ children, className, destructive, ...props }: {
  children: ReactNode;
  className?: string;
  destructive?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus:bg-[var(--accent)] focus:text-[var(--accent-foreground)]",
        destructive && "text-[var(--destructive)] hover:text-[var(--destructive)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-[var(--border)]", className)} />;
}

export { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator };
