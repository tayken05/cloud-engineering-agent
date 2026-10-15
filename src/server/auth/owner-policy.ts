export class OwnerAuthorizationError extends Error {
  readonly reason: "unauthenticated" | "forbidden" | "configuration";
  constructor(reason: "unauthenticated" | "forbidden" | "configuration") {
    super(reason === "forbidden" ? "This account is not authorized for the owner workspace." : "Owner authorization failed.");
    this.name = "OwnerAuthorizationError";
    this.reason = reason;
  }
}

export function authorizeOwnerId(sessionUserId: string | null | undefined, configuredOwnerId: string | null | undefined): string {
  if (!configuredOwnerId) throw new OwnerAuthorizationError("configuration");
  if (!sessionUserId) throw new OwnerAuthorizationError("unauthenticated");
  if (sessionUserId !== configuredOwnerId) throw new OwnerAuthorizationError("forbidden");
  return sessionUserId;
}
