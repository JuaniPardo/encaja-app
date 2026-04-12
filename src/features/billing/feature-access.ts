import type { SubscriptionPlan, SubscriptionStatus } from "@/types/database";

export const BILLING_ENABLED = false;

export type WorkspaceFeature =
  | "multi_workspace"
  | "workspace_sharing"
  | "workspace_linking"
  | "advanced_insights";

export type WorkspaceSubscriptionSnapshot = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
};

const featurePlanAccess: Record<WorkspaceFeature, SubscriptionPlan[]> = {
  multi_workspace: ["free", "pro", "premium"],
  workspace_sharing: ["pro", "premium"],
  workspace_linking: ["premium"],
  advanced_insights: ["pro", "premium"],
};

export function canUseFeature(
  subscription: WorkspaceSubscriptionSnapshot | null | undefined,
  feature: WorkspaceFeature,
) {
  if (!BILLING_ENABLED) {
    return true;
  }

  if (!subscription || subscription.status !== "active") {
    return false;
  }

  return featurePlanAccess[feature].includes(subscription.plan);
}
