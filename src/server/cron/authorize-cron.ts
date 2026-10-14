import "server-only";

import { timingSafeEqual } from "node:crypto";

export type CronAuthorization =
  | Readonly<{ authorized: true }>
  | Readonly<{ authorized: false; status: 401 | 404 | 503 }>;

function equalSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function authorizeCronRequest(
  request: Request,
  environment: Readonly<NodeJS.ProcessEnv> = process.env,
): CronAuthorization {
  if (environment.VERCEL !== "1" || environment.VERCEL_ENV !== "production") {
    return Object.freeze({ authorized: false, status: 404 });
  }
  const secret = environment.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return Object.freeze({ authorized: false, status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization || !equalSecret(authorization, `Bearer ${secret}`)) {
    return Object.freeze({ authorized: false, status: 401 });
  }
  return Object.freeze({ authorized: true });
}
