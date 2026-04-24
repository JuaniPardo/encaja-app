import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { defaultLocale, localeCookieName, normalizeLocale, type Locale } from "@/features/i18n/config";
import { pickActiveWorkspace } from "@/features/workspace/context-routing";
import { getWorkspaceSlugFromPathname } from "@/features/workspace/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getAccessTokenFromSessionCookie } from "@/lib/supabase/session-cookie";
import {
  bootstrapUserWorkspace,
  listUserWorkspaces,
  type WorkspaceSummary,
} from "@/lib/workspace/bootstrap";

export interface InitialWorkspaceContext {
  user: User;
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  locale: Locale;
}

export async function resolveInitialWorkspaceContext(): Promise<InitialWorkspaceContext> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const pathname = headerStore.get("x-encaja-pathname") ?? "/app";
  const accessToken = getAccessTokenFromSessionCookie(cookieStore.toString());

  if (!accessToken) {
    redirect("/login");
  }

  const supabase = createSupabaseServerClient(accessToken);
  const userResponse = await supabase.auth.getUser(accessToken);

  if (userResponse.error || !userResponse.data.user) {
    redirect("/login");
  }

  const user = userResponse.data.user;
  const fullNameFromMetadata =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;
  const localeFromCookie = normalizeLocale(cookieStore.get(localeCookieName)?.value ?? null) ?? defaultLocale;

  await bootstrapUserWorkspace({
    supabase,
    user,
    fullNameHint: fullNameFromMetadata,
    preferredLanguageHint: localeFromCookie,
  });

  const profileResponse = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();
  const locale =
    normalizeLocale(profileResponse.data?.preferred_language ?? null) ??
    localeFromCookie;

  const workspaces = await listUserWorkspaces({ supabase, user });
  const workspace = pickActiveWorkspace(workspaces, {
    routeWorkspaceSlug: getWorkspaceSlugFromPathname(pathname),
    currentWorkspaceSlug: null,
    rememberedWorkspaceSlug: null,
  });

  if (!workspace) {
    redirect("/login");
  }

  return {
    user,
    workspace,
    workspaces,
    locale,
  };
}
