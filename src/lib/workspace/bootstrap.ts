import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeLocale, type Locale } from "@/features/i18n/config";
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

type CreateWorkspaceRpcRow =
  Database["public"]["Functions"]["create_workspace_with_defaults"]["Returns"][number];
type DeleteWorkspaceRpcRow =
  Database["public"]["Functions"]["delete_workspace"]["Returns"][number];

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
  preferredLanguageHint?: Locale;
}

interface ListWorkspacesOptions {
  supabase: SupabaseClient<Database>;
  user: User;
}

interface CreateWorkspaceOptions {
  supabase: SupabaseClient<Database>;
  user: User;
  name: string;
  preferredLanguageHint?: Locale;
}

interface DeleteWorkspaceOptions {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
}

function buildWorkspaceName(fullNameHint: string | undefined, email: string | undefined) {
  if (fullNameHint && fullNameHint.trim().length > 0) {
    return `Workspace de ${fullNameHint.trim()}`;
  }

  if (email && email.includes("@")) {
    return `Workspace de ${email.split("@")[0]}`;
  }

  return "Mi Workspace";
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

function toWorkspaceSummaryFromRpc(row: CreateWorkspaceRpcRow): WorkspaceSummary {
  return {
    id: row.workspace_id,
    name: row.workspace_name,
    slug: row.workspace_slug,
    role: row.workspace_role,
    subscription: {
      plan: row.subscription_plan,
      status: row.subscription_status,
    },
  };
}

async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User,
  fullNameHint?: string,
  preferredLanguageHint?: Locale,
) {
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

  const normalizedLanguage = normalizeLocale(preferredLanguageHint ?? null);
  if (!normalizedLanguage) {
    return;
  }

  const profileLanguageUpdate = await supabase
    .from("profiles")
    .update({
      preferred_language: normalizedLanguage,
    })
    .eq("id", user.id)
    .is("preferred_language", null);

  if (profileLanguageUpdate.error) {
    throw profileLanguageUpdate.error;
  }
}

async function createWorkspaceWithDefaults(
  supabase: SupabaseClient<Database>,
  workspaceName: string,
): Promise<WorkspaceSummary> {
  const rpcResponse = await supabase.rpc("create_workspace_with_defaults", {
    p_workspace_name: workspaceName,
  });

  if (rpcResponse.error) {
    throw rpcResponse.error;
  }

  const createdRow = (rpcResponse.data ?? [])[0] as CreateWorkspaceRpcRow | undefined;
  if (!createdRow) {
    throw new Error("No pudimos crear el workspace.");
  }

  return toWorkspaceSummaryFromRpc(createdRow);
}

export async function createWorkspaceForUser({
  supabase,
  user,
  name,
  preferredLanguageHint,
}: CreateWorkspaceOptions): Promise<WorkspaceSummary> {
  await ensureUserProfile(supabase, user, undefined, preferredLanguageHint);

  const workspaceName = name.trim();
  if (workspaceName.length < 2) {
    throw new Error("El nombre del workspace debe tener al menos 2 caracteres.");
  }

  return createWorkspaceWithDefaults(supabase, workspaceName);
}

export async function deleteWorkspaceForUser({
  supabase,
  workspaceId,
}: DeleteWorkspaceOptions): Promise<DeleteWorkspaceRpcRow> {
  const rpcResponse = await supabase.rpc("delete_workspace", {
    p_workspace_id: workspaceId,
  });

  if (rpcResponse.error) {
    throw new Error(rpcResponse.error.message);
  }

  const deletedRow = (rpcResponse.data ?? [])[0] as DeleteWorkspaceRpcRow | undefined;
  if (!deletedRow) {
    throw new Error("No pudimos eliminar el workspace.");
  }

  return deletedRow;
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
  preferredLanguageHint,
}: BootstrapOptions): Promise<WorkspaceSummary> {
  await ensureUserProfile(supabase, user, fullNameHint, preferredLanguageHint);

  const existingWorkspaces = await listUserWorkspaces({ supabase, user });
  if (existingWorkspaces.length > 0) {
    return existingWorkspaces[0];
  }

  const workspaceName = buildWorkspaceName(fullNameHint, user.email);
  return createWorkspaceWithDefaults(supabase, workspaceName);
}
