import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export interface WorkspaceSummary {
  id: string;
  name: string;
}

interface BootstrapOptions {
  supabase: SupabaseClient<Database>;
  user: User;
  fullNameHint?: string;
}

const defaultCurrency = "ARS";
const defaultSavingsRateMode = "manual" as const;

function buildWorkspaceName(fullNameHint: string | undefined, email: string | undefined) {
  if (fullNameHint && fullNameHint.trim().length > 0) {
    return `Workspace de ${fullNameHint.trim()}`;
  }

  if (email && email.includes("@")) {
    return `Workspace de ${email.split("@")[0]}`;
  }

  return "Mi Workspace";
}

function buildWorkspaceSlug(base: string) {
  const normalized = base
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .trim()
    .replaceAll(/\s+/g, "-")
    .slice(0, 36);

  const fallback = normalized.length > 0 ? normalized : "workspace";
  const suffix = Math.floor(Math.random() * 10_000);
  return `${fallback}-${suffix}`;
}

async function ensureWorkspaceSettings(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
) {
  const existingSettings = await supabase
    .from("workspace_settings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingSettings.error) {
    throw existingSettings.error;
  }

  if (existingSettings.data) {
    return;
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  const settingsInsert = await supabase.from("workspace_settings").insert({
    workspace_id: workspaceId,
    start_year: currentYear,
    savings_rate_mode: defaultSavingsRateMode,
    deferred_income_enabled: false,
    deferred_income_day: null,
    currency_code: defaultCurrency,
  });

  if (settingsInsert.error && settingsInsert.error.code !== "23505") {
    throw settingsInsert.error;
  }
}

async function getFirstWorkspaceForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkspaceSummary | null> {
  const membershipQuery = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipQuery.error) {
    throw membershipQuery.error;
  }

  if (!membershipQuery.data?.workspace_id) {
    return null;
  }

  const workspaceQuery = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", membershipQuery.data.workspace_id)
    .maybeSingle();

  if (workspaceQuery.error) {
    throw workspaceQuery.error;
  }

  if (!workspaceQuery.data) {
    return null;
  }

  return workspaceQuery.data;
}

export async function bootstrapUserWorkspace({
  supabase,
  user,
  fullNameHint,
}: BootstrapOptions): Promise<WorkspaceSummary> {
  const profileUpsert = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      ...(fullNameHint && fullNameHint.trim().length > 0
        ? { full_name: fullNameHint.trim() }
        : {}),
    },
    { onConflict: "id" },
  );

  if (profileUpsert.error) {
    throw profileUpsert.error;
  }

  const existingWorkspace = await getFirstWorkspaceForUser(supabase, user.id);
  if (existingWorkspace) {
    await ensureWorkspaceSettings(supabase, existingWorkspace.id);
    return existingWorkspace;
  }

  const workspaceName = buildWorkspaceName(fullNameHint, user.email);

  const workspaceInsert = await supabase
    .from("workspaces")
    .insert({
      name: workspaceName,
      slug: buildWorkspaceSlug(workspaceName),
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (workspaceInsert.error) {
    throw workspaceInsert.error;
  }

  const workspace = workspaceInsert.data;

  const membershipInsert = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  if (membershipInsert.error && membershipInsert.error.code !== "23505") {
    throw membershipInsert.error;
  }

  await ensureWorkspaceSettings(supabase, workspace.id);

  return workspace;
}
