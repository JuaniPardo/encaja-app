import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSupabaseVerifierClient } from "@/lib/supabase/server-verifier";
import { getAccessTokenFromSessionCookie } from "@/lib/supabase/session-cookie";
import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";

const authPages = new Set(["/login", "/register"]);

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

async function isValidToken(accessToken: string) {
  const verifier = getSupabaseVerifierClient();
  const userResponse = await verifier.auth.getUser(accessToken);
  return !userResponse.error && Boolean(userResponse.data.user);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = getAccessTokenFromSessionCookie(request.headers.get("cookie"));

  const requiresAuth = pathname.startsWith("/app") || pathname === "/";
  const isAuthPage = authPages.has(pathname);

  if (!accessToken) {
    if (requiresAuth) {
      return redirectTo("/login", request);
    }

    return NextResponse.next();
  }

  const tokenIsValid = await isValidToken(accessToken);

  if (!tokenIsValid) {
    if (requiresAuth) {
      const response = redirectTo("/login", request);
      clearAuthCookie(response);
      return response;
    }

    if (isAuthPage) {
      const response = NextResponse.next();
      clearAuthCookie(response);
      return response;
    }

    return NextResponse.next();
  }

  if (isAuthPage || pathname === "/") {
    return redirectTo("/app", request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
