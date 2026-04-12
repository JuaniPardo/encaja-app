import { buildWorkspaceHref, getWorkspaceScopedSectionPath, getWorkspaceSlugFromPathname } from "@/features/workspace/routing";
import type { WorkspaceSummary } from "@/lib/workspace/bootstrap";

const legacySectionNames = [
  "insights",
  "budget",
  "transactions",
  "categories",
  "payment-methods",
  "settings",
] as const;

interface PickActiveWorkspaceOptions {
  routeWorkspaceSlug: string | null;
  currentWorkspaceSlug: string | null;
  rememberedWorkspaceSlug: string | null;
}

export function pickActiveWorkspace(
  workspaces: WorkspaceSummary[],
  options: PickActiveWorkspaceOptions,
): WorkspaceSummary | null {
  if (workspaces.length === 0) {
    return null;
  }

  if (options.routeWorkspaceSlug) {
    const fromRoute = workspaces.find((workspace) => workspace.slug === options.routeWorkspaceSlug);
    if (fromRoute) {
      return fromRoute;
    }
  }

  if (options.currentWorkspaceSlug) {
    const currentWorkspace = workspaces.find(
      (workspace) => workspace.slug === options.currentWorkspaceSlug,
    );
    if (currentWorkspace) {
      return currentWorkspace;
    }
  }

  if (options.rememberedWorkspaceSlug) {
    const rememberedWorkspace = workspaces.find(
      (workspace) => workspace.slug === options.rememberedWorkspaceSlug,
    );
    if (rememberedWorkspace) {
      return rememberedWorkspace;
    }
  }

  return workspaces[0];
}

export function buildFallbackWorkspacePath(pathname: string, workspaceSlug: string) {
  const maybeLegacySection = getWorkspaceSlugFromPathname(pathname);
  if (maybeLegacySection && legacySectionNames.includes(maybeLegacySection as (typeof legacySectionNames)[number])) {
    return buildWorkspaceHref(workspaceSlug, `/${maybeLegacySection}`);
  }

  const scopedSectionPath = getWorkspaceScopedSectionPath(pathname);
  return buildWorkspaceHref(workspaceSlug, scopedSectionPath);
}
