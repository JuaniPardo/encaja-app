import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSupabaseVerifierClient } from "@/lib/supabase/server-verifier";
import { getAccessTokenFromSessionCookie } from "@/lib/supabase/session-cookie";
import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";
import { ROUTES } from "@/lib/routes";

const authPages: ReadonlySet<string> = new Set([ROUTES.LOGIN, ROUTES.REGISTER]);
const pathnameHeader = "x-encaja-pathname";

function redirectTo(pathname: string, request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: SUPABASE_AUTH_STORAGE_KEY,
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(pathnameHeader, request.nextUrl.pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

async function isValidToken(accessToken: string) {
  const verifier = getSupabaseVerifierClient();
  const userResponse = await verifier.auth.getUser(accessToken);
  return !userResponse.error && Boolean(userResponse.data.user);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = getAccessTokenFromSessionCookie(request.headers.get("cookie"));

  const requiresAuth = pathname.startsWith(ROUTES.APP) || pathname === ROUTES.ROOT;
  const isAuthPage = authPages.has(pathname);

  if (!accessToken) {
    if (requiresAuth) {
      return redirectTo(ROUTES.LOGIN, request);
    }

    return nextWithPathname(request);
  }

  const tokenIsValid = await isValidToken(accessToken);

  if (!tokenIsValid) {
    if (requiresAuth) {
      const response = redirectTo(ROUTES.LOGIN, request);
      clearAuthCookie(response);
      return response;
    }

    if (isAuthPage) {
      const response = nextWithPathname(request);
      clearAuthCookie(response);
      return response;
    }

    return nextWithPathname(request);
  }

  if (isAuthPage || pathname === ROUTES.ROOT) {
    return redirectTo(ROUTES.APP, request);
  }

  return nextWithPathname(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
