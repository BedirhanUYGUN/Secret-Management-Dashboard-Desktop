import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Search } from "lucide-react";
import { fetchProjects, searchSecrets, type ProjectSummary } from "@core/api/client";
import { useAuth } from "@core/auth/AuthContext";
import type { Environment, Secret, SecretType } from "@core/types";
import { Badge } from "@core/ui/Badge";
import { Input } from "@core/ui/Input";
import { Select } from "@core/ui/Select";
import { Spinner } from "@core/ui/Spinner";

const environments: Array<Environment | "all"> = ["all", "local", "dev", "prod"];
const secretTypes: Array<SecretType | "all"> = ["all", "key", "token", "endpoint"];

const envBadgeVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  local: "secondary",
  dev: "warning",
  prod: "destructive",
};

export function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [environmentFilter, setEnvironmentFilter] = useState<Environment | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SecretType | "all">("all");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [results, setResults] = useState<Secret[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchProjects()
      .then(setProjects)
      .catch((error: Error) => setErrorMessage(error.message));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setErrorMessage("");
    setLoading(true);

    void searchSecrets({
      query,
      provider: providerFilter === "all" ? undefined : providerFilter,
      tag: tagFilter === "all" ? undefined : tagFilter,
      environment: environmentFilter === "all" ? undefined : environmentFilter,
      type: typeFilter === "all" ? undefined : typeFilter,
    })
      .then(setResults)
      .catch((error: Error) => {
        setResults([]);
        setErrorMessage(error.message || "Arama başarısız.");
      })
      .finally(() => setLoading(false));
  }, [environmentFilter, providerFilter, query, tagFilter, typeFilter, user]);

  const providers = useMemo(() => Array.from(new Set(results.map((item) => item.provider))), [results]);
  const tags = useMemo(() => Array.from(new Set(results.flatMap((item) => item.tags))), [results]);

  if (!user) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Genel Arama</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ad, sağlayıcı veya anahtar ile ara..."
            className="pl-8"
          />
        </div>
        <Select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="w-auto min-w-[150px]"
        >
          <option value="all">Tüm sağlayıcılar</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
        <Select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="w-auto min-w-[130px]"
        >
          <option value="all">Tüm etiketler</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>
        <Select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value as Environment | "all")}
          className="w-auto min-w-[130px]"
        >
          {environments.map((env) => (
            <option key={env} value={env}>
              {env === "all" ? "Tüm ortamlar" : env.toUpperCase()}
            </option>
          ))}
        </Select>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as SecretType | "all")}
          className="w-auto min-w-[120px]"
        >
          {secretTypes.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "Tüm tipler" : type.toUpperCase()}
            </option>
          ))}
        </Select>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {errorMessage}
        </div>
      )}
      {loading && <Spinner text="Arama yapılıyor..." />}

      {/* Results */}
      <div className="space-y-2">
        {results.map((item) => {
          const projectName = projects.find((p) => p.id === item.projectId)?.name ?? item.projectId;
          return (
            <Link
              key={item.id}
              to={`/projects?project=${item.projectId}&env=${item.environment}&secret=${item.id}`}
              className="block group"
            >
              <div className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 hover:border-[var(--primary)]/50 hover:bg-[var(--accent)] transition-colors">
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-1 items-center">
                  <span className="font-medium text-sm text-[var(--foreground)] truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] truncate hidden sm:block">
                    {projectName}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] hidden sm:block">
                    {item.provider}
                  </span>
                  <Badge
                    variant={envBadgeVariant[item.environment] ?? "outline"}
                    className="w-fit hidden sm:flex"
                  >
                    {item.environment.toUpperCase()}
                  </Badge>
                  <code className="text-xs text-[var(--muted-foreground)] font-mono truncate hidden sm:block max-w-[160px]">
                    {item.valueMasked}
                  </code>
                </div>
                <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}

        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-[var(--muted-foreground)]/40 mb-4" />
            <h3 className="text-base font-medium text-[var(--foreground)] mb-1">
              Sonuç bulunamadı
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Mevcut filtrelerle eşleşen anahtar bulunamadı. Filtrelerinizi değiştirmeyi deneyin.
            </p>
          </div>
        )}
      </div>

      {results.length > 0 && !loading && (
        <p className="text-xs text-[var(--muted-foreground)] text-right">
          {results.length} sonuç bulundu
        </p>
      )}
    </div>
  );
}
