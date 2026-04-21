import type { SupabaseClient, User } from "@supabase/supabase-js";

import { defaultLocale, normalizeLocale, type Locale } from "@/features/i18n/config";
import {
  BALANCE_ADJUSTMENT_SYSTEM_KEY,
  createDemoPaymentMethods,
  resolveBalanceAdjustmentCategoryForWorkspace,
} from "@/lib/workspace/demo";
import {
  buildDemoSeed,
  materializeDemoSeedInstallmentPurchases,
  materializeDemoSeedTransactions,
} from "@/lib/workspace/demo-seed";
import type {
  Database,
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceRole,
} from "@/types/database";

type WorkspaceRow = Pick<
  Database["public"]["Tables"]["workspaces"]["Row"],
  "id" | "name" | "slug" | "is_demo" | "created_at"
>;

type WorkspaceMemberRow = Pick<
  Database["public"]["Tables"]["workspace_members"]["Row"],
  "workspace_id" | "role"
>;

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "workspace_id" | "plan" | "status"
>;
type SystemCategoryRow = Pick<
  Database["public"]["Tables"]["system_categories"]["Row"],
  "id" | "key"
>;
type WorkspaceCategoryBySystemRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "system_category_id"
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
  isDemo: boolean;
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

interface CreateDemoWorkspaceOptions {
  supabase: SupabaseClient<Database>;
  user: User;
  name: string;
  preferredLanguageHint?: Locale;
}

interface DeleteWorkspaceOptions {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
}

const workspaceBootstrapMessages = {
  es: {
    workspacePrefix: "Workspace de",
    defaultWorkspaceName: "Mi Workspace",
    createWorkspaceFailed: "No pudimos crear el workspace.",
    workspaceNameMinLength: "El nombre del workspace debe tener al menos 2 caracteres.",
    demoWorkspaceAlreadyExists: "Ya tenés una Caja Demo activa.",
  },
  en: {
    workspacePrefix: "Workspace for",
    defaultWorkspaceName: "My Workspace",
    createWorkspaceFailed: "We couldn't create the workspace.",
    workspaceNameMinLength: "Workspace name must be at least 2 characters.",
    demoWorkspaceAlreadyExists: "You already have an active Demo workspace.",
  },
} as const;

function resolveWorkspaceBootstrapMessages(preferredLanguageHint?: Locale) {
  const locale = normalizeLocale(preferredLanguageHint ?? null) ?? defaultLocale;
  return workspaceBootstrapMessages[locale];
}

function buildWorkspaceName(
  fullNameHint: string | undefined,
  email: string | undefined,
  preferredLanguageHint?: Locale,
) {
  const messages = resolveWorkspaceBootstrapMessages(preferredLanguageHint);

  if (fullNameHint && fullNameHint.trim().length > 0) {
    return `${messages.workspacePrefix} ${fullNameHint.trim()}`;
  }

  if (email && email.includes("@")) {
    return `${messages.workspacePrefix} ${email.split("@")[0]}`;
  }

  return messages.defaultWorkspaceName;
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
    isDemo: workspace.is_demo,
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
    isDemo: row.workspace_is_demo,
    role: row.workspace_role,
    subscription: {
      plan: row.subscription_plan,
      status: row.subscription_status,
    },
  };
}

function resolveErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }

  return fallbackMessage;
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
  isDemo = false,
  preferredLanguageHint?: Locale,
): Promise<WorkspaceSummary> {
  const rpcResponse = await supabase.rpc("create_workspace_with_defaults", {
    p_workspace_name: workspaceName,
    p_is_demo: isDemo,
  });

  if (rpcResponse.error) {
    if (isDemo && rpcResponse.error.code === "23505") {
      const messages = resolveWorkspaceBootstrapMessages(preferredLanguageHint);
      throw new Error(messages.demoWorkspaceAlreadyExists);
    }
    throw rpcResponse.error;
  }

  const createdRow = (rpcResponse.data ?? [])[0] as CreateWorkspaceRpcRow | undefined;
  if (!createdRow) {
    const messages = resolveWorkspaceBootstrapMessages(preferredLanguageHint);
    throw new Error(messages.createWorkspaceFailed);
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
  const messages = resolveWorkspaceBootstrapMessages(preferredLanguageHint);

  const workspaceName = name.trim();
  if (workspaceName.length < 2) {
    throw new Error(messages.workspaceNameMinLength);
  }

  return createWorkspaceWithDefaults(supabase, workspaceName, false, preferredLanguageHint);
}

export async function createDemoWorkspaceForUser({
  supabase,
  user,
  name,
  preferredLanguageHint,
}: CreateDemoWorkspaceOptions): Promise<WorkspaceSummary> {
  await ensureUserProfile(supabase, user, undefined, preferredLanguageHint);
  const messages = resolveWorkspaceBootstrapMessages(preferredLanguageHint);

  const workspaceName = name.trim();
  if (workspaceName.length < 2) {
    throw new Error(messages.workspaceNameMinLength);
  }

  const existingDemoResponse = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", user.id)
    .eq("is_demo", true)
    .limit(1);

  if (existingDemoResponse.error) {
    throw existingDemoResponse.error;
  }

  if ((existingDemoResponse.data ?? []).length > 0) {
    throw new Error(messages.demoWorkspaceAlreadyExists);
  }

  let createdWorkspace: WorkspaceSummary | null = null;

  try {
    createdWorkspace = await createWorkspaceWithDefaults(
      supabase,
      workspaceName,
      true,
      preferredLanguageHint,
    );

    const demoPaymentMethods = await createDemoPaymentMethods({
      supabase,
      workspaceId: createdWorkspace.id,
      userId: user.id,
    });

    const balanceAdjustmentCategory = await resolveBalanceAdjustmentCategoryForWorkspace({
      supabase,
      workspaceId: createdWorkspace.id,
    });

    const seed = buildDemoSeed(new Date());
    const requiredSystemKeys = Array.from(
      new Set([
        ...seed.transactions.map((transaction) => transaction.categoryKey),
        ...seed.installmentPurchases.map((purchase) => purchase.categoryKey),
      ]),
    );

    const systemCategoriesResponse = await supabase
      .from("system_categories")
      .select("id, key")
      .in("key", requiredSystemKeys);

    if (systemCategoriesResponse.error) {
      throw systemCategoriesResponse.error;
    }

    const systemCategoryRows = (systemCategoriesResponse.data ?? []) as SystemCategoryRow[];
    const systemCategoryIdByKey = new Map(
      systemCategoryRows.map((systemCategory) => [systemCategory.key, systemCategory.id]),
    );

    if (
      !systemCategoryIdByKey.has(BALANCE_ADJUSTMENT_SYSTEM_KEY) &&
      systemCategoryIdByKey.has(balanceAdjustmentCategory.systemKey)
    ) {
      systemCategoryIdByKey.set(
        BALANCE_ADJUSTMENT_SYSTEM_KEY,
        systemCategoryIdByKey.get(balanceAdjustmentCategory.systemKey) as string,
      );
    }

    const missingSystemKeys = requiredSystemKeys.filter((key) => !systemCategoryIdByKey.has(key));
    if (missingSystemKeys.length > 0) {
      throw new Error(`Faltan categorías sistema para el demo: ${missingSystemKeys.join(", ")}`);
    }

    const requiredSystemCategoryIds = Array.from(
      new Set(
        requiredSystemKeys
          .map((key) => systemCategoryIdByKey.get(key))
          .filter((systemCategoryId): systemCategoryId is string => Boolean(systemCategoryId)),
      ),
    );

    const workspaceCategoriesResponse = await supabase
      .from("categories")
      .select("id, system_category_id")
      .eq("workspace_id", createdWorkspace.id)
      .eq("source", "system")
      .in("system_category_id", requiredSystemCategoryIds);

    if (workspaceCategoriesResponse.error) {
      throw workspaceCategoriesResponse.error;
    }

    const workspaceCategoryRows = (workspaceCategoriesResponse.data ?? []) as WorkspaceCategoryBySystemRow[];
    const workspaceCategoryIdBySystemCategoryId = new Map(
      workspaceCategoryRows
        .filter(
          (
            workspaceCategory,
          ): workspaceCategory is WorkspaceCategoryBySystemRow & { system_category_id: string } =>
            Boolean(workspaceCategory.system_category_id),
        )
        .map((workspaceCategory) => [workspaceCategory.system_category_id, workspaceCategory.id]),
    );

    const categoryIdByKey = Object.fromEntries(
      requiredSystemKeys.map((key) => {
        const systemCategoryId = systemCategoryIdByKey.get(key) as string;
        const categoryId = workspaceCategoryIdBySystemCategoryId.get(systemCategoryId);
        if (!categoryId) {
          throw new Error(`No encontramos la categoría del workspace para ${key}.`);
        }

        return [key, categoryId];
      }),
    );

    const installmentPurchases = materializeDemoSeedInstallmentPurchases({
      workspaceId: createdWorkspace.id,
      userId: user.id,
      seed,
      categoryIdByKey,
      paymentMethodIdByKey: {
        debit: demoPaymentMethods.debit.id,
        cash: demoPaymentMethods.cash.id,
        credit: demoPaymentMethods.credit.id,
      },
    });

    const transactions = materializeDemoSeedTransactions({
      workspaceId: createdWorkspace.id,
      userId: user.id,
      seed,
      categoryIdByKey,
      paymentMethodIdByKey: {
        debit: demoPaymentMethods.debit.id,
        cash: demoPaymentMethods.cash.id,
        credit: demoPaymentMethods.credit.id,
      },
    });

    if (transactions.length === 0) {
      throw new Error("No pudimos generar transacciones demo.");
    }

    if (installmentPurchases.length > 0) {
      const installmentPurchasesInsertResponse = await supabase
        .from("installment_purchases")
        .insert(installmentPurchases);
      if (installmentPurchasesInsertResponse.error) {
        throw installmentPurchasesInsertResponse.error;
      }
    }

    const transactionsInsertResponse = await supabase.from("transactions").insert(transactions);
    if (transactionsInsertResponse.error) {
      throw transactionsInsertResponse.error;
    }

    return createdWorkspace;
  } catch (error) {
    if (createdWorkspace) {
      await deleteWorkspaceForUser({
        supabase,
        workspaceId: createdWorkspace.id,
      }).catch(() => undefined);
    }

    throw new Error(resolveErrorMessage(error, messages.createWorkspaceFailed));
  }
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
      .select("id, name, slug, is_demo, created_at")
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

  const workspaceName = buildWorkspaceName(fullNameHint, user.email, preferredLanguageHint);
  return createWorkspaceWithDefaults(supabase, workspaceName, false, preferredLanguageHint);
}
