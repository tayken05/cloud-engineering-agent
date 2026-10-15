import "server-only";

export type OwnerAuthConfig = Readonly<{
  baseUrl: string;
  cookieSecret: string;
  ownerUserId: string;
}>;
export type NeonAuthConfig = Omit<OwnerAuthConfig, "ownerUserId">;

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export function readNeonAuthConfig(environment: Readonly<NodeJS.ProcessEnv> = process.env): NeonAuthConfig {
  const baseUrl = environment.NEON_AUTH_BASE_URL?.trim();
  const cookieSecret = environment.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!baseUrl || !cookieSecret) throw new AuthConfigurationError("Managed authentication is not fully configured.");
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new AuthConfigurationError("The managed authentication URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new AuthConfigurationError("The managed authentication URL must be credential-free HTTPS.");
  }
  if (cookieSecret.length < 32) throw new AuthConfigurationError("The authentication cookie secret is invalid.");
  return { baseUrl: url.toString().replace(/\/$/, ""), cookieSecret };
}

export function readConfiguredOwnerId(environment: Readonly<NodeJS.ProcessEnv> = process.env): string {
  const ownerUserId = environment.OWNER_AUTH_USER_ID?.trim();
  if (!ownerUserId || !/^[A-Za-z0-9_-]{8,128}$/.test(ownerUserId)) throw new AuthConfigurationError("The owner user identifier is not configured.");
  return ownerUserId;
}

export function readOwnerAuthConfig(environment: Readonly<NodeJS.ProcessEnv> = process.env): OwnerAuthConfig {
  return { ...readNeonAuthConfig(environment), ownerUserId: readConfiguredOwnerId(environment) };
}
