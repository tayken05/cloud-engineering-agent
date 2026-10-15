import { getAuth } from "@/server/auth/auth";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: AuthRouteContext): Promise<Response> {
  try {
    const path = (await context.params).path;
    if (path[0] === "sign-up") return Response.json({ error: "Public registration is disabled." }, { status: 404 });
    if (path[0] === "email-otp" || (path[0] === "sign-in" && path[1] === "email-otp")) {
      return Response.json({ error: "Direct email-code operations are disabled." }, { status: 404 });
    }
    const handlers = getAuth().handler();
    const method = request.method as keyof typeof handlers;
    const handler = handlers[method];
    if (typeof handler !== "function") return new Response("Method not allowed", { status: 405 });
    return handler(request, context);
  } catch {
    return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
