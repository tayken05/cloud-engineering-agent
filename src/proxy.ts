import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/server/auth/auth";

export default function proxy(request: NextRequest) {
  try {
    return getAuth().middleware({ loginUrl: "/sign-in" })(request);
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=configuration", request.url));
  }
}

export const config = { matcher: ["/ideas/:path*", "/studio/:path*"] };
