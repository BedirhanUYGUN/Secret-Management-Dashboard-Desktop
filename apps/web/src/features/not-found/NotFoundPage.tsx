import { Link } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="rounded-full bg-[var(--muted)] p-6 mb-6">
        <SearchX className="h-12 w-12 text-[var(--muted-foreground)]" />
      </div>
      <h1 className="text-6xl font-bold text-[var(--foreground)] mb-2">404</h1>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">
        Sayfa bulunamadı
      </h2>
      <p className="text-sm text-[var(--muted-foreground)] max-w-sm mb-8">
        Aradığınız sayfa mevcut değil veya taşındı.
      </p>
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors px-4 py-2 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Projelere Dön
      </Link>
    </div>
  );
}
