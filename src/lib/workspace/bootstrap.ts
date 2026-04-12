import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeWorkspaceSlug } from "@/features/workspace/routing";
import type {
  Database,
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceRole,
} from "@/types/database";

type WorkspaceRow = Pick<
  Database["public"]["Tables"]["workspaces"]["Row"],
  "id" | "name" | "slug" | "created_at"
>;

type WorkspaceMemberRow = Pick<
  Database["public"]["Tables"]["workspace_members"]["Row"],
  "workspace_id" | "role"
>;

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "workspace_id" | "plan" | "status"
>;

export interface WorkspaceSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  subscription: WorkspaceSubscription | null;
}

interface BootstrapOptions {
  supabase: SupabaseClient<Database>;
  user: User;
  fullNameHint?: string;
}

interface ListWorkspacesOptions {
  supabase: SupabaseClient<Database>;
  user: User;
}

interface CreateWorkspaceOptions {
  supabase: SupabaseClient<Database>;
  user: User;
  name: string;
}

const defaultCurrency = "ARS";
const defaultSavingsRateMode = "manual" as const;
const defaultShowCents = false;
const defaultSubscriptionPlan: SubscriptionPlan = "premium";
const defaultSubscriptionStatus: SubscriptionStatus = "active";
const workspaceSlugFallback = "workspace";
const maxCreateWorkspaceAttempts = 8;

function buildWorkspaceName(fullNameHint: string | undefined, email: string | undefined) {
  if (fullNameHint && fullNameHint.trim().length > 0) {
    return `Workspace de ${fullNameHint.trim()}`;
  }

  if (email && email.includes("@")) {
    return `Workspace de ${email.split("@")[0]}`;
  }

  return "Mi Workspace";
}

function buildWorkspaceSlugBase(value: string) {
  const normalized = normalizeWorkspaceSlug(value).slice(0, 36);
  return normalized.length > 0 ? normalized : workspaceSlugFallback;
}

function buildWorkspaceSlugCandidate(base: string, attempt: number) {
  if (attempt <= 0) {
    return base;
  }

  const suffix = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");
  return `${base}-${suffix}`;
}

function toWorkspaceSummary(
  workspace: WorkspaceRow,
  role: WorkspaceRole | undefined,
  subscription: SubscriptionRow | undefined,
): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: role ?? "member",
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
        }
      : null,
  };
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
    show_cents: defaultShowCents,
  });

  if (settingsInsert.error && settingsInsert.error.code !== "23505") {
    throw settingsInsert.error;
  }
}

async function ensureWorkspaceSubscription(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
) {
  const existingSubscription = await supabase
    .from("subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingSubscription.error) {
    throw existingSubscription.error;
  }

  if (existingSubscription.data) {
    return;
  }

  const insertResponse = await supabase.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan: defaultSubscriptionPlan,
    status: defaultSubscriptionStatus,
  });

  if (insertResponse.error && insertResponse.error.code !== "23505") {
    throw insertResponse.error;
  }
}

async function ensureWorkspaceFoundations(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
) {
  await ensureWorkspaceSettings(supabase, workspaceId);
  await ensureWorkspaceSubscription(supabase, workspaceId);
}

async function createWorkspaceRecord({
  supabase,
  user,
  name,
}: CreateWorkspaceOptions): Promise<WorkspaceRow> {
  const slugBase = buildWorkspaceSlugBase(name);

  for (let attempt = 0; attempt < maxCreateWorkspaceAttempts; attempt += 1) {
    const slugCandidate = buildWorkspaceSlugCandidate(slugBase, attempt);

    const workspaceInsert = await supabase
      .from("workspaces")
      .insert({
        name,
        slug: slugCandidate,
        created_by: user.id,
      })
      .select("id, name, slug, created_at")
      .single();

    if (!workspaceInsert.error) {
      return workspaceInsert.data;
    }

    if (workspaceInsert.error.code !== "23505") {
      throw workspaceInsert.error;
    }
  }

  throw new Error("No pudimos generar un slug único para el workspace.");
}

export async function createWorkspaceForUser({
  supabase,
  user,
  name,
}: CreateWorkspaceOptions): Promise<WorkspaceSummary> {
  const workspaceName = name.trim();
  if (workspaceName.length < 2) {
    throw new Error("El nombre del workspace debe tener al menos 2 caracteres.");
  }

  const workspace = await createWorkspaceRecord({
    supabase,
    user,
    name: workspaceName,
  });

  const membershipInsert = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  if (membershipInsert.error && membershipInsert.error.code !== "23505") {
    throw membershipInsert.error;
  }

  await ensureWorkspaceFoundations(supabase, workspace.id);

  const subscriptionResponse = await supabase
    .from("subscriptions")
    .select("workspace_id, plan, status")
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (subscriptionResponse.error) {
    throw subscriptionResponse.error;
  }

  return toWorkspaceSummary(workspace, "owner", subscriptionResponse.data ?? undefined);
}

export async function listUserWorkspaces({
  supabase,
  user,
}: ListWorkspacesOptions): Promise<WorkspaceSummary[]> {
  const [workspacesResponse, membershipsResponse] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id),
  ]);

  if (workspacesResponse.error) {
    throw workspacesResponse.error;
  }

  if (membershipsResponse.error) {
    throw membershipsResponse.error;
  }

  const workspaceRows = (workspacesResponse.data ?? []) as WorkspaceRow[];
  if (workspaceRows.length === 0) {
    return [];
  }

  const workspaceIds = workspaceRows.map((workspace) => workspace.id);
  const subscriptionsResponse = await supabase
    .from("subscriptions")
    .select("workspace_id, plan, status")
    .in("workspace_id", workspaceIds);

  if (subscriptionsResponse.error) {
    throw subscriptionsResponse.error;
  }

  const roleByWorkspaceId = new Map(
    ((membershipsResponse.data ?? []) as WorkspaceMemberRow[]).map((membership) => [
      membership.workspace_id,
      membership.role,
    ]),
  );

  const subscriptionByWorkspaceId = new Map(
    ((subscriptionsResponse.data ?? []) as SubscriptionRow[]).map((subscription) => [
      subscription.workspace_id,
      subscription,
    ]),
  );

  return workspaceRows.map((workspace) =>
    toWorkspaceSummary(
      workspace,
      roleByWorkspaceId.get(workspace.id),
      subscriptionByWorkspaceId.get(workspace.id),
    ),
  );
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

  const existingWorkspaces = await listUserWorkspaces({ supabase, user });
  if (existingWorkspaces.length > 0) {
    await ensureWorkspaceFoundations(supabase, existingWorkspaces[0].id);
    return existingWorkspaces[0];
  }

  const workspaceName = buildWorkspaceName(fullNameHint, user.email);
  return createWorkspaceForUser({
    supabase,
    user,
    name: workspaceName,
  });
}
