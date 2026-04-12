import type { WorkspaceRole } from "@/types/database";

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
