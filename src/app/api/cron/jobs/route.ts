import { authorizeCronRequest } from "@/server/cron/authorize-cron";
import {
  PRODUCTION_DATABASE_ENDPOINT,
  runJobDiscovery,
} from "@/server/jobs/discovery/run-job-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DISCOVERY_BUDGET_MS = 225_000;

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request);
  if (!authorization.authorized) {
    return Response.json({ ok: false }, {
      headers: { "cache-control": "no-store" },
      status: authorization.status,
    });
  }

  try {
    const result = await runJobDiscovery({
      expectedEndpoint: PRODUCTION_DATABASE_ENDPOINT,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(DISCOVERY_BUDGET_MS)]),
      trigger: "scheduled",
    });
    return Response.json({
      closedJobs: result.closedJobs,
      failedSources: result.failedSources,
      insertedJobs: result.insertedJobs,
      ok: result.status === "succeeded" || result.status === "skipped",
      pendingVerificationJobs: result.pendingVerificationJobs,
      runId: result.runId,
      status: result.status,
      successfulSources: result.successfulSources,
      unchangedJobs: result.unchangedJobs,
      updatedJobs: result.updatedJobs,
      verifiedJobs: result.verifiedJobs,
    }, {
      headers: { "cache-control": "no-store" },
      status: result.status === "failed" ? 502 : 200,
    });
  } catch {
    console.error("[cron/jobs] Scheduled discovery failed; inspect the private run record.");
    return Response.json({ ok: false, status: "failed" }, {
      headers: { "cache-control": "no-store" }, status: 500,
    });
  }
}
