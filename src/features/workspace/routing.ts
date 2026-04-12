const APP_BASE_PATH = "/app";

export function normalizeWorkspaceSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 40);
}

export function getWorkspaceSlugFromPathname(pathname: string) {
  if (!pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments[1] ?? null;
}

function normalizeSectionPath(sectionPath: string | null | undefined) {
  if (!sectionPath || sectionPath === "/") {
    return "";
  }

  if (sectionPath.startsWith("/")) {
    return sectionPath;
  }

  return `/${sectionPath}`;
}

export function buildWorkspaceHref(workspaceSlug: string, sectionPath?: string | null) {
  const safeSectionPath = normalizeSectionPath(sectionPath);
  return `${APP_BASE_PATH}/${workspaceSlug}${safeSectionPath}`;
}

export function stripWorkspaceSlugFromPathname(pathname: string) {
  const slug = getWorkspaceSlugFromPathname(pathname);
  if (!slug) {
    return pathname;
  }

  const prefix = `${APP_BASE_PATH}/${slug}`;
  const remainder = pathname.slice(prefix.length);
  return `${APP_BASE_PATH}${remainder || ""}`;
}

export function getWorkspaceScopedSectionPath(pathname: string) {
  const slug = getWorkspaceSlugFromPathname(pathname);
  if (!slug) {
    return "";
  }

  const prefix = `${APP_BASE_PATH}/${slug}`;
  return pathname.slice(prefix.length);
}
