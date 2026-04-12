import type { WorkspaceRole } from "@/types/database";

export function canManageWorkspaceStructure(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageWorkspaceSettings(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canBootstrapWorkspaceFoundations(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canDeleteWorkspace(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManageWorkspaceMembers(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManageCategories(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManagePaymentMethods(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManageBudgetStructure(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManageTransactions(role: WorkspaceRole) {
  return role === "owner" || role === "member";
}
