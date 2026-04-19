import { describe, expect, it } from "vitest";

import {
  canBootstrapWorkspaceFoundations,
  canManageBudgetStructure,
  canManageCategories,
  canDeleteWorkspace,
  canManageWorkspaceLinks,
  canManageWorkspaceMembers,
  canManagePaymentMethods,
  canManageWorkspaceSettings,
  canManageWorkspaceStructure,
  canManageTransactions,
} from "@/features/workspace/permissions";

describe("workspace role permissions", () => {
  it("allows owner to manage structural actions", () => {
    expect(canManageWorkspaceStructure("owner")).toBe(true);
    expect(canManageWorkspaceSettings("owner")).toBe(true);
    expect(canBootstrapWorkspaceFoundations("owner")).toBe(true);
    expect(canDeleteWorkspace("owner")).toBe(true);
    expect(canManageWorkspaceMembers("owner")).toBe(true);
    expect(canManageWorkspaceLinks("owner")).toBe(true);
    expect(canManageCategories("owner")).toBe(true);
    expect(canManagePaymentMethods("owner")).toBe(true);
    expect(canManageBudgetStructure("owner")).toBe(true);
    expect(canManageTransactions("owner")).toBe(true);
  });

  it("allows member structural actions but blocks owner-only actions", () => {
    expect(canManageWorkspaceStructure("member")).toBe(true);
    expect(canManageWorkspaceSettings("member")).toBe(false);
    expect(canBootstrapWorkspaceFoundations("member")).toBe(false);
    expect(canDeleteWorkspace("member")).toBe(false);
    expect(canManageWorkspaceMembers("member")).toBe(false);
    expect(canManageWorkspaceLinks("member")).toBe(false);
    expect(canManageCategories("member")).toBe(true);
    expect(canManagePaymentMethods("member")).toBe(true);
    expect(canManageBudgetStructure("member")).toBe(true);
    expect(canManageTransactions("member")).toBe(true);
  });

  it("keeps owner/member structural permissions consistent", () => {
    expect(canManageCategories("member")).toBe(true);
    expect(canManagePaymentMethods("member")).toBe(true);
    expect(canManageBudgetStructure("member")).toBe(true);
    expect(canManageCategories("owner")).toBe(true);
  });
});
