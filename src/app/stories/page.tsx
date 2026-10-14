import type { Metadata } from "next";
import { connection } from "next/server";

import {
  NewsCatalog,
  NewsCatalogError,
  NewsFilters,
} from "@/components/news/news-catalog";
import { PageLayout } from "@/components/workspace/page-layout";
import { parseNewsFilters, type NewsSearchParams } from "@/features/news/news-filters";
import { getSection } from "@/lib/workspace";
import { listNews } from "@/server/news/list-news";

export const metadata: Metadata = { title: `${getSection("/stories").title} | Cloud Engineering Agent` };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<NewsSearchParams>;
}) {
  // A real request gates the uncached database query, keeping builds credential-free.
  await connection();
  const filters = parseNewsFilters(await searchParams);
  const section = getSection("/stories");

  let catalog;
  try {
    catalog = await listNews(filters);
  } catch {
    console.error("[stories] The database-backed news query failed.");
  }

  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      {catalog ? (
        <>
          <NewsFilters filters={filters} sources={catalog.sources} />
          <NewsCatalog catalog={catalog} />
        </>
      ) : (
        <NewsCatalogError />
      )}
    </PageLayout>
  );
}
