import { describe, expect, it } from "vitest";

import { buildWorkspaceHref } from "@/features/workspace/routing";
import {
  buildFallbackWorkspacePath,
  pickActiveWorkspace,
} from "@/features/workspace/context-routing";
import type { WorkspaceSummary } from "@/lib/workspace/bootstrap";

function buildWorkspace(id: string, slug: string): WorkspaceSummary {
  return {
    id,
    slug,
    name: slug,
    role: "owner",
    subscription: {
      plan: "premium",
      status: "active",
    },
  };
}

describe("workspace context routing", () => {
  it("selects route workspace during initial load", () => {
    const workspaces = [buildWorkspace("1", "hogar"), buildWorkspace("2", "consultorio")];

    const selected = pickActiveWorkspace(workspaces, {
      routeWorkspaceSlug: "consultorio",
      currentWorkspaceSlug: null,
      rememberedWorkspaceSlug: "hogar",
    });

    expect(selected?.slug).toBe("consultorio");
  });

  it("falls back to remembered workspace when route slug is invalid", () => {
    const workspaces = [buildWorkspace("1", "hogar"), buildWorkspace("2", "consultorio")];

    const selected = pickActiveWorkspace(workspaces, {
      routeWorkspaceSlug: "slug-invalido",
      currentWorkspaceSlug: null,
      rememberedWorkspaceSlug: "consultorio",
    });

    expect(selected?.slug).toBe("consultorio");
  });

  it("maps invalid workspace slug URL to same section in active workspace", () => {
    const fallbackPath = buildFallbackWorkspacePath("/app/slug-invalido/transactions", "hogar");

    expect(fallbackPath).toBe("/app/hogar/transactions");
  });

  it("maps legacy section URLs to workspace-scoped URLs", () => {
    const fallbackPath = buildFallbackWorkspacePath("/app/insights", "hogar");

    expect(fallbackPath).toBe("/app/hogar/insights");
  });

  it("builds workspace-scoped URLs for workspace switch", () => {
    expect(buildWorkspaceHref("hogar", "/categories")).toBe("/app/hogar/categories");
  });
});
