import { authorizeCronRequest } from "@/server/cron/authorize-cron";
import {
  PRODUCTION_DATABASE_ENDPOINT,
  runNewsCollection,
} from "@/server/ingestion/run-collection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COLLECTION_BUDGET_MS = 225_000;

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request);
  if (!authorization.authorized) {
    return Response.json(
      { ok: false },
      {
        headers: { "cache-control": "no-store" },
        status: authorization.status,
      },
    );
  }

  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(COLLECTION_BUDGET_MS),
    ]);
    const result = await runNewsCollection({
      expectedEndpoint: PRODUCTION_DATABASE_ENDPOINT,
      signal,
      trigger: "scheduled",
    });
    const ok = result.status === "succeeded" || result.status === "skipped";
    return Response.json(
      {
        failedSources: result.failedSources,
        insertedItems: result.insertedItems,
        ok,
        runId: result.runId,
        status: result.status,
        successfulSources: result.successfulSources,
        unchangedItems: result.unchangedItems,
        updatedItems: result.updatedItems,
      },
      {
        headers: { "cache-control": "no-store" },
        status: result.status === "failed" ? 502 : 200,
      },
    );
  } catch {
    console.error("[cron/news] Scheduled collection failed; inspect the private run record.");
    return Response.json(
      { ok: false, status: "failed" },
      { headers: { "cache-control": "no-store" }, status: 500 },
    );
  }
}
