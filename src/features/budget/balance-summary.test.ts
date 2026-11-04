import { describe, expect, it } from "vitest";

import { resolveBudgetBalanceSummary } from "@/features/budget/balance-summary";
import { getTranslation } from "@/features/i18n/dictionaries";

describe("resolveBudgetBalanceSummary", () => {
  it.each([0, 0.004, -0.004])("treats a balance of %s as balanced", (balance) => {
    expect(resolveBudgetBalanceSummary(balance)).toEqual({
      status: "balanced",
      messageKey: "budget.summary.balancedMessage",
      amount: 0,
    });
  });

  it("reports the amount still available to assign", () => {
    expect(resolveBudgetBalanceSummary(150)).toEqual({
      status: "remaining",
      messageKey: "budget.summary.remainingMessage",
      amount: 150,
    });
  });

  it("reports the overassigned amount as a positive value", () => {
    expect(resolveBudgetBalanceSummary(-50)).toEqual({
      status: "overassigned",
      messageKey: "budget.summary.overMessage",
      amount: 50,
    });
  });

  it("describes an overassigned budget without calling it exceeded", () => {
    const summary = resolveBudgetBalanceSummary(-50);
    const message = getTranslation("es", summary.messageKey, undefined, { amount: "$ 50" });

    expect(message).not.toContain("excedido");
    expect(message).toContain("por encima de tus ingresos");
    expect(getTranslation("es", resolveBudgetBalanceSummary(0).messageKey)).toBe(
      "Tu presupuesto del período está balanceado.",
    );
  });
});
