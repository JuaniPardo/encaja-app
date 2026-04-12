import { describe, expect, it } from "vitest";

import {
  canBootstrapWorkspaceFoundations,
  canManageBudgetStructure,
  canManageCategories,
  canDeleteWorkspace,
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
    expect(canManageCategories("owner")).toBe(true);
    expect(canManagePaymentMethods("owner")).toBe(true);
    expect(canManageBudgetStructure("owner")).toBe(true);
    expect(canManageTransactions("owner")).toBe(true);
  });

  it("blocks member from structural actions but keeps transaction operations", () => {
    expect(canManageWorkspaceStructure("member")).toBe(false);
    expect(canManageWorkspaceSettings("member")).toBe(false);
    expect(canBootstrapWorkspaceFoundations("member")).toBe(false);
    expect(canDeleteWorkspace("member")).toBe(false);
    expect(canManageWorkspaceMembers("member")).toBe(false);
    expect(canManageCategories("member")).toBe(false);
    expect(canManagePaymentMethods("member")).toBe(false);
    expect(canManageBudgetStructure("member")).toBe(false);
    expect(canManageTransactions("member")).toBe(true);
  });

  it("enforces hardening scenarios for owner/member", () => {
    expect(canManageCategories("member")).toBe(false);
    expect(canManagePaymentMethods("member")).toBe(false);
    expect(canManageBudgetStructure("member")).toBe(false);
    expect(canManageCategories("owner")).toBe(true);
  });
});
