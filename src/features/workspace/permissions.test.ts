import { describe, expect, it } from "vitest";

import {
  canBootstrapWorkspaceFoundations,
  canDeleteWorkspace,
  canManageWorkspaceSettings,
} from "@/features/workspace/permissions";

describe("workspace role permissions", () => {
  it("allows owner to manage settings and foundations", () => {
    expect(canManageWorkspaceSettings("owner")).toBe(true);
    expect(canBootstrapWorkspaceFoundations("owner")).toBe(true);
    expect(canDeleteWorkspace("owner")).toBe(true);
  });

  it("blocks member from owner-only actions", () => {
    expect(canManageWorkspaceSettings("member")).toBe(false);
    expect(canBootstrapWorkspaceFoundations("member")).toBe(false);
    expect(canDeleteWorkspace("member")).toBe(false);
  });
});
