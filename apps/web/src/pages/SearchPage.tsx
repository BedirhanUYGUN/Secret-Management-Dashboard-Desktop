import { useMemo, useState } from "react";
import { projects, secrets } from "../data/mockData";
import { useAuth } from "../auth/AuthContext";

export function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

  if (!user) {
    return null;
  }

  const assignments = new Set(user.assignments.map((item) => item.projectId));
  const providers = Array.from(new Set(secrets.map((item) => item.provider)));
  const tags = Array.from(new Set(secrets.flatMap((item) => item.tags)));

  const results = useMemo(() => {
    return secrets.filter((item) => {
      if (!assignments.has(item.projectId)) {
        return false;
      }
      const textMatch = [item.name, item.provider, item.keyName, item.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const providerMatch = providerFilter === "all" || item.provider === providerFilter;
      const tagMatch = tagFilter === "all" || item.tags.includes(tagFilter);
      return textMatch && providerMatch && tagMatch;
    });
  }, [assignments, providerFilter, query, tagFilter]);

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
