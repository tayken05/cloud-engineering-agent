import "server-only";

import { redirect } from "next/navigation";

import { getAuth } from "./auth";
import { readConfiguredOwnerId } from "./config";
import { authorizeOwnerId, OwnerAuthorizationError } from "./owner-policy";

export async function getRequiredOwnerId(): Promise<string> {
  let configuredOwnerId: string;
  try { configuredOwnerId = readConfiguredOwnerId(); } catch { throw new OwnerAuthorizationError("configuration"); }
  const result = await getAuth().getSession();
  return authorizeOwnerId(result.data?.user?.id, configuredOwnerId);
}

export async function requireOwnerPage(returnTo: string): Promise<string> {
  try { return await getRequiredOwnerId(); } catch (error) {
    if (error instanceof OwnerAuthorizationError && error.reason === "forbidden") redirect("/auth/forbidden");
    if (error instanceof OwnerAuthorizationError && error.reason === "configuration") redirect("/sign-in?error=configuration");
    redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }
}
