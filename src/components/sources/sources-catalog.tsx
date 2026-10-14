import Link from "next/link";

import {
  formatSourceLabel,
  SOURCE_KIND_VALUES,
  SOURCE_STATUS_VALUES,
  SOURCE_TOPIC_VALUES,
  type SourceFilters,
} from "@/features/sources/source-filters";
import type { SourceCatalogRecord } from "@/server/sources/list-sources";

export function SourcesFilters({ filters }: { filters: SourceFilters }) {
  return (
    <form className="source-filters" action="/sources" method="get" aria-label="Filter technology sources">
      <label className="source-search">
        <span>Search</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          maxLength={100}
          placeholder="Search names and descriptions"
        />
      </label>
      <label>
        <span>Topic</span>
        <select name="topic" defaultValue={filters.topic ?? ""}>
          <option value="">All topics</option>
          {SOURCE_TOPIC_VALUES.map((topic) => (
            <option key={topic} value={topic}>{formatSourceLabel(topic)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Source type</span>
        <select name="kind" defaultValue={filters.kind ?? ""}>
          <option value="">All types</option>
          {SOURCE_KIND_VALUES.map((kind) => (
            <option key={kind} value={kind}>{formatSourceLabel(kind)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select name="status" defaultValue={filters.status}>
          {SOURCE_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>{formatSourceLabel(status)}</option>
          ))}
        </select>
      </label>
      <div className="source-filter-actions">
        <button type="submit">Apply filters</button>
        <Link href="/sources">Clear</Link>
      </div>
    </form>
  );
}

export function SourcesCatalog({
  sources,
}: {
  sources: readonly SourceCatalogRecord[];
}) {
  if (sources.length === 0) {
    return (
      <section className="source-state" aria-labelledby="sources-empty-title">
        <span className="badge">0 sources</span>
        <h2 id="sources-empty-title">No sources match these filters</h2>
        <p>Try a broader search or clear one of the selected filters.</p>
        <Link className="text-link" href="/sources">Clear all filters</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="sources-results-title">
      <div className="source-results-heading">
        <div>
          <p className="eyebrow">Registered catalog</p>
          <h2 id="sources-results-title">Technology sources</h2>
        </div>
        <span className="badge">{sources.length} {sources.length === 1 ? "source" : "sources"}</span>
      </div>
      <ul className="source-grid">
        {sources.map((source) => (
          <li className="source-card" key={source.key}>
            <div className="source-card-heading">
              <div>
                <p className="source-topic">
                  {source.primaryTopic ? formatSourceLabel(source.primaryTopic) : "Uncategorized"}
                </p>
                <h3>{source.name}</h3>
              </div>
              <span className={source.isActive ? "status-chip is-active" : "status-chip"}>
                <span aria-hidden="true" />
                {source.isActive ? "Enabled" : "Disabled"}
              </span>
            </div>
            {source.description ? <p className="source-description">{source.description}</p> : null}
            <div className="source-card-footer">
              <span>{formatSourceLabel(source.kind)}</span>
              <a href={source.canonicalUrl} target="_blank" rel="noreferrer">
                Visit official site <span aria-hidden="true">↗</span>
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="source-disclaimer">
        Registration identifies a first-party source. Individual items still require evidence review before they can be treated as verified.
      </p>
    </section>
  );
}

export function SourcesCatalogError() {
  return (
    <section className="source-state source-error" role="status" aria-labelledby="sources-error-title">
      <span className="badge">Temporarily unavailable</span>
      <h2 id="sources-error-title">The source catalog could not be loaded</h2>
      <p>The database request did not complete. No source data was changed.</p>
    </section>
  );
}
