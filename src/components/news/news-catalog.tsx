import Link from "next/link";

import type { NewsFilters } from "@/features/news/news-filters";
import {
  formatSourceLabel,
  SOURCE_TOPIC_VALUES,
} from "@/features/sources/source-filters";
import type { NewsCatalog as NewsCatalogData } from "@/server/news/list-news";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function NewsFilters({
  filters,
  sources,
}: {
  filters: NewsFilters;
  sources: NewsCatalogData["sources"];
}) {
  return (
    <form className="news-filters" action="/stories" method="get" aria-label="Filter collected news">
      <label>
        <span>Technology category</span>
        <select name="topic" defaultValue={filters.topic ?? ""}>
          <option value="">All categories</option>
          {SOURCE_TOPIC_VALUES.map((topic) => (
            <option key={topic} value={topic}>{formatSourceLabel(topic)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Publisher</span>
        <select name="source" defaultValue={filters.source ?? ""}>
          <option value="">All publishers</option>
          {sources.map((source) => (
            <option key={source.key} value={source.key}>{source.name}</option>
          ))}
        </select>
      </label>
      <div className="news-filter-actions">
        <button type="submit">Apply filters</button>
        <Link href="/stories">Clear</Link>
      </div>
    </form>
  );
}

export function NewsCatalog({ catalog }: { catalog: NewsCatalogData }) {
  if (catalog.items.length === 0) {
    return (
      <section className="source-state" aria-labelledby="news-empty-title">
        <span className="badge">0 collected items</span>
        <h2 id="news-empty-title">No publisher updates match these filters</h2>
        <p>Try another category or publisher, or clear the selected filters.</p>
        <Link className="text-link" href="/stories">Clear all filters</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="news-results-title">
      <div className="source-results-heading">
        <div>
          <p className="eyebrow">Collected publisher updates</p>
          <h2 id="news-results-title">Latest technology news</h2>
        </div>
        <span className="badge">
          {catalog.items.length} {catalog.items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <ol className="news-list">
        {catalog.items.map((item) => {
          const displayDate = item.publishedAt ?? item.collectedAt;
          return (
            <li className="news-card" key={item.id}>
              <div className="news-meta">
                <span>{item.sourceName}</span>
                <span aria-hidden="true">•</span>
                <span>{item.primaryTopic ? formatSourceLabel(item.primaryTopic) : "Uncategorized"}</span>
                <span aria-hidden="true">•</span>
                <time dateTime={displayDate.toISOString()}>
                  {dateFormatter.format(displayDate)}
                </time>
              </div>
              <h3>
                <a href={item.originalUrl} target="_blank" rel="noreferrer">
                  {item.title} <span aria-hidden="true">↗</span>
                </a>
              </h3>
              {item.summary ? <p className="news-summary">{item.summary}</p> : null}
              <div className="news-footer">
                <span>{item.author ? `By ${item.author}` : "Publisher attribution retained"}</span>
                <span>Collected from the publisher · Not independently verified</span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="source-disclaimer">
        These entries are publisher-supplied metadata with original links. Collection records provenance; it does not independently verify a development or create a verified story.
      </p>
    </section>
  );
}

export function NewsCatalogError() {
  return (
    <section className="source-state source-error" role="status" aria-labelledby="news-error-title">
      <span className="badge">Temporarily unavailable</span>
      <h2 id="news-error-title">Collected news could not be loaded</h2>
      <p>The database request did not complete. No publisher data was changed.</p>
    </section>
  );
}
