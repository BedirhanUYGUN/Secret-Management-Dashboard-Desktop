import { useEffect, useMemo, useState } from "react";
import { fetchProjects, searchSecrets } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Project, Secret } from "../types";

type ProjectSummary = Project & { keyCount: number };

export function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [results, setResults] = useState<Secret[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }
    void fetchProjects(user.role)
      .then(setProjects)
      .catch((error: Error) => setErrorMessage(error.message));
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setErrorMessage("");

    void searchSecrets({
      role: user.role,
      query,
      provider: providerFilter === "all" ? undefined : providerFilter,
      tag: tagFilter === "all" ? undefined : tagFilter,
    })
      .then(setResults)
      .catch((error: Error) => {
        setResults([]);
        setErrorMessage(error.message || "Search failed.");
      });
  }, [providerFilter, query, tagFilter, user]);

  const providers = useMemo(() => Array.from(new Set(results.map((item) => item.provider))), [results]);
  const tags = useMemo(() => Array.from(new Set(results.flatMap((item) => item.tags))), [results]);

  if (!user) {
    return null;
  }

  return (
    <section className="page-panel">
      <h2>Global Search</h2>
      <div className="search-controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, provider, key" />
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
          <option value="all">All providers</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
        <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
          <option value="all">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && <p className="inline-error">{errorMessage}</p>}

      <div className="search-results">
        {results.map((item) => (
          <div key={item.id} className="result-item">
            <strong>{item.name}</strong>
            <span>{projects.find((project) => project.id === item.projectId)?.name ?? item.projectId}</span>
            <span>{item.provider}</span>
            <span>{item.environment.toUpperCase()}</span>
            <code>{item.valueMasked}</code>
          </div>
        ))}
        {results.length === 0 && <p>No matches for current filters.</p>}
      </div>
    </section>
  );
}
