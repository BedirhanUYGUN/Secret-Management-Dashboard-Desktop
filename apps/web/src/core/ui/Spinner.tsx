import { Loader2 } from "lucide-react";

type SpinnerProps = {
  text?: string;
  variant?: "spinner" | "skeleton-table";
};

export function Spinner({ text = "Yükleniyor...", variant = "spinner" }: SpinnerProps) {
  if (variant === "skeleton-table") {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-label={text}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 5 }, (_, j) => (
              <div
                key={j}
                className="h-4 flex-1 animate-pulse rounded bg-[var(--muted)]"
                style={{ animationDelay: `${(i * 5 + j) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      {text && <span className="text-sm text-[var(--muted-foreground)]">{text}</span>}
    </div>
  );
}
