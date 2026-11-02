import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionTokensFromCookie } from "@/lib/supabase/session-cookie";
import { resolveSessionTokens } from "@/lib/supabase/session-refresh";
import {
  SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS,
  SUPABASE_AUTH_STORAGE_KEY,
} from "@/lib/supabase/config";
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

function writeAuthCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: SUPABASE_AUTH_STORAGE_KEY,
    value,
    maxAge: SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS,
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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const tokens = getSessionTokensFromCookie(request.headers.get("cookie"));

  const requiresAuth = pathname.startsWith(ROUTES.APP) || pathname === ROUTES.ROOT;
  const isAuthPage = authPages.has(pathname);

  if (!tokens) {
    if (requiresAuth) {
      return redirectTo(ROUTES.LOGIN, request);
    }

    return nextWithPathname(request);
  }

  const resolution = await resolveSessionTokens(tokens);

  if (resolution.status === "unverified") {
    return nextWithPathname(request);
  }

  if (resolution.status === "rejected") {
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

  if (resolution.status === "renewed") {
    const value = JSON.stringify(resolution.session);
    request.cookies.set(SUPABASE_AUTH_STORAGE_KEY, value);

    const response =
      isAuthPage || pathname === ROUTES.ROOT
        ? redirectTo(ROUTES.APP, request)
        : nextWithPathname(request);
    writeAuthCookie(response, value);
    return response;
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
