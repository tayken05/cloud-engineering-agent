import type { Metadata } from "next";
import { connection } from "next/server";

import {
  SourcesCatalog,
  SourcesCatalogError,
  SourcesFilters,
} from "@/components/sources/sources-catalog";
import { PageLayout } from "@/components/workspace/page-layout";
import { parseSourceFilters, type SourceSearchParams } from "@/features/sources/source-filters";
import { getSection } from "@/lib/workspace";
import { listSources } from "@/server/sources/list-sources";

export const metadata: Metadata = { title: `${getSection("/sources").title} | Cloud Engineering Agent` };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SourceSearchParams>;
}) {
  // The catalog is intentionally uncached for this first read path. Waiting for
  // a request keeps database access out of static generation and production builds.
  await connection();
  const filters = parseSourceFilters(await searchParams);
  const section = getSection("/sources");

  let catalog;
  try {
    catalog = await listSources(filters);
  } catch {
    console.error("[sources] The database-backed catalog query failed.");
  }

  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <SourcesFilters filters={filters} />
      {catalog ? (
        <SourcesCatalog sources={catalog} />
      ) : (
        <SourcesCatalogError />
      )}
    </PageLayout>
  );
}
