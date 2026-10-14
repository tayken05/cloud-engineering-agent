import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { listOpenJobSitemapEntries } from "@/server/jobs/list-jobs";

const SITE_URL = "https://cloud-engineering-agent.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/jobs`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/stories`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/sources`, changeFrequency: "weekly", priority: 0.7 },
  ];
  try {
    const jobs = await listOpenJobSitemapEntries();
    return [
      ...staticEntries,
      ...jobs.map((job) => ({
        url: `${SITE_URL}/jobs/${job.slug}`,
        lastModified: job.lastModified,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    console.error("[sitemap] Job URLs could not be loaded; serving static entries only.");
    return staticEntries;
  }
}
