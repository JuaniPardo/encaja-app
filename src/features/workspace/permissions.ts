import type { WorkspaceRole } from "@/types/database";

export function canManageWorkspaceStructure(role: WorkspaceRole) {
  return role === "owner" || role === "member";
}

export function canManageWorkspaceSettings(role: WorkspaceRole) {
  return role === "owner";
}

export function canBootstrapWorkspaceFoundations(role: WorkspaceRole) {
  return role === "owner";
}

export function canDeleteWorkspace(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageWorkspaceMembers(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageWorkspaceLinks(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageCategories(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManagePaymentMethods(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageBudgetStructure(role: WorkspaceRole) {
  return canManageWorkspaceStructure(role);
}

export function canManageTransactions(role: WorkspaceRole) {
  return role === "owner" || role === "member";
}
