import { NextResponse, type NextRequest } from "next/server";

/**
 * La console e' interna: nessun motore di ricerca la indicizza, nessuna
 * risposta viene messa in cache da un proxy.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (request.nextUrl.pathname.startsWith("/studio")) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: ["/studio/:path*", "/api/run/:path*"],
};
