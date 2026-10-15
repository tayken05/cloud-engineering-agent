import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

import { readNeonAuthConfig } from "./config";

let instance: NeonAuth | undefined;

export function getAuth(): NeonAuth {
  if (!instance) {
    const config = readNeonAuthConfig();
    instance = createNeonAuth({
      baseUrl: config.baseUrl,
      cookies: { secret: config.cookieSecret, sessionDataTtl: 300 },
      logLevel: "warn",
    });
  }
  return instance;
}
