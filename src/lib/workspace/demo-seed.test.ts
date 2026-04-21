import { describe, expect, it } from "vitest";

import { type DemoPaymentMethodKey } from "@/lib/workspace/demo";
import {
  buildDemoSeed,
  materializeDemoSeedBudget,
  materializeDemoSeedInstallmentPurchases,
  materializeDemoSeedTransactions,
} from "@/lib/workspace/demo-seed";

function getDayOfMonth(dateOnly: string) {
  return Number(dateOnly.slice(8, 10));
}

function buildMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return { start, end };
}

function filterSeedRowsByMonth(
  rows: Array<{ transactionDate: string; effectiveDate: string | null }>,
  year: number,
  month: number,
) {
  const { start, end } = buildMonthRange(year, month);

  return rows.filter((row) => {
    if (row.effectiveDate) {
      return row.effectiveDate >= start && row.effectiveDate < end;
    }

    return row.transactionDate >= start && row.transactionDate < end;
  });
}

describe("buildDemoSeed", () => {
  it("never creates future dates in current month", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));

    const currentMonthTransactions = seed.transactions.filter((transaction) =>
      transaction.key.endsWith("_current") || transaction.key.includes("_current_"),
    );

    expect(currentMonthTransactions.length).toBeGreaterThan(0);
    expect(currentMonthTransactions.every((transaction) => getDayOfMonth(transaction.transactionDate) <= 19)).toBe(true);
  });

  it("resolves base day 31 correctly for month lengths 28, 30 and 31", () => {
    const februarySeed = buildDemoSeed(new Date("2026-03-15T12:00:00Z"));
    const aprilSeed = buildDemoSeed(new Date("2026-05-15T12:00:00Z"));
    const marchSeed = buildDemoSeed(new Date("2026-04-15T12:00:00Z"));

    expect(
      februarySeed.transactions.find((transaction) => transaction.key === "expense_subscription_end_previous")
        ?.transactionDate,
    ).toBe("2026-02-28");

    expect(
      aprilSeed.transactions.find((transaction) => transaction.key === "expense_subscription_end_previous")
        ?.transactionDate,
    ).toBe("2026-04-30");

    expect(
      marchSeed.transactions.find((transaction) => transaction.key === "expense_subscription_end_previous")
        ?.transactionDate,
    ).toBe("2026-03-31");
  });

  it("creates linked transfer pairs for card payment and cash withdrawal", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));

    const transferRows = seed.transactions.filter((transaction) => transaction.transferGroupKey !== null);
    const transferGroupKeys = Array.from(
      new Set(
        transferRows
          .map((row) => row.transferGroupKey)
          .filter((transferGroupKey): transferGroupKey is string => Boolean(transferGroupKey)),
      ),
    ).sort();

    expect(transferRows).toHaveLength(4);
    expect(transferGroupKeys).toEqual([
      "transfer_card_payment_current",
      "transfer_cash_withdrawal_previous",
    ]);

    for (const transferGroupKey of transferGroupKeys) {
      const rowsByGroup = transferRows.filter((row) => row.transferGroupKey === transferGroupKey);
      expect(rowsByGroup).toHaveLength(2);
      expect(rowsByGroup.map((row) => row.direction).sort()).toEqual(["in", "out"]);
    }

    expect(transferRows.every((row) => row.type === "transfer")).toBe(true);
  });

  it("keeps cash balance non-negative with debit withdrawal support", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));
    const signedCashBalance = seed.transactions
      .filter((transaction) => transaction.paymentMethodKey === "cash")
      .reduce((sum, transaction) => {
        if (transaction.type === "income") {
          return sum + transaction.amount;
        }

        if (transaction.type === "expense" || transaction.type === "saving") {
          return sum - transaction.amount;
        }

        if (transaction.type === "transfer") {
          return sum + (transaction.direction === "in" ? transaction.amount : -transaction.amount);
        }

        return sum;
      }, 0);

    expect(signedCashBalance).toBeGreaterThanOrEqual(0);
  });

  it("inserts initial balance adjustments on day 1 of previous month", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));

    const adjustmentRows = seed.transactions.filter((transaction) =>
      transaction.key.startsWith("adjustment_"),
    );

    expect(adjustmentRows).toHaveLength(3);
    expect(adjustmentRows.every((transaction) => transaction.type === "expense")).toBe(true);
    expect(adjustmentRows.every((transaction) => transaction.categoryKey === "balance_adjustment")).toBe(true);
    expect(adjustmentRows.every((transaction) => transaction.transactionDate === "2026-03-01")).toBe(true);
  });

  it("adds installment purchases and keeps month visibility rules for installment rows", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));

    expect(seed.installmentPurchases.map((purchase) => purchase.key).sort()).toEqual([
      "installment_purchase_cellphone_previous",
      "installment_purchase_clothing_current",
    ]);

    const cellphoneInstallments = seed.transactions
      .filter((row) => row.installmentPurchaseKey === "installment_purchase_cellphone_previous")
      .sort((left, right) => Number(left.installmentNumber ?? 0) - Number(right.installmentNumber ?? 0));
    expect(cellphoneInstallments).toHaveLength(6);
    expect(cellphoneInstallments.map((row) => row.installmentNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cellphoneInstallments[0]?.description).toBe("Celular - cuota 1 de 6");
    expect(cellphoneInstallments[1]?.description).toBe("Celular - cuota 2 de 6");

    const clothingInstallments = seed.transactions
      .filter((row) => row.installmentPurchaseKey === "installment_purchase_clothing_current")
      .sort((left, right) => Number(left.installmentNumber ?? 0) - Number(right.installmentNumber ?? 0));
    expect(clothingInstallments).toHaveLength(6);
    expect(clothingInstallments.map((row) => row.installmentNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(clothingInstallments[0]?.description).toBe("Ropa - cuota 1 de 6");

    const visibleInstallmentsCurrentMonth = filterSeedRowsByMonth(
      seed.transactions.filter((row) => row.installmentPurchaseKey !== null),
      2026,
      4,
    );
    const currentDescriptions = visibleInstallmentsCurrentMonth
      .map((row) => row.description)
      .filter((description): description is string => Boolean(description));
    expect(currentDescriptions).toContain("Celular - cuota 2 de 6");
    expect(currentDescriptions).toContain("Ropa - cuota 1 de 6");
    expect(currentDescriptions).not.toContain("Ropa - cuota 2 de 6");

    const visibleInstallmentsPreviousMonth = filterSeedRowsByMonth(
      seed.transactions.filter((row) => row.installmentPurchaseKey !== null),
      2026,
      3,
    );
    const previousDescriptions = visibleInstallmentsPreviousMonth
      .map((row) => row.description)
      .filter((description): description is string => Boolean(description));
    expect(previousDescriptions).toContain("Celular - cuota 1 de 6");
    expect(previousDescriptions).not.toContain("Ropa - cuota 1 de 6");
  });

  it("materializes transaction inserts with stable transfer_group_id", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));

    const categoryIdByKey = Object.fromEntries(
      Array.from(new Set(seed.transactions.map((transaction) => transaction.categoryKey))).map((key) => [
        key,
        `category-${key}`,
      ]),
    );

    const paymentMethodIdByKey: Record<DemoPaymentMethodKey, string> = {
      debit: "payment-method-debit",
      cash: "payment-method-cash",
      credit: "payment-method-credit",
    };

    const rows = materializeDemoSeedTransactions({
      workspaceId: "workspace-1",
      userId: "user-1",
      seed,
      categoryIdByKey,
      paymentMethodIdByKey,
    });
    const installmentPurchases = materializeDemoSeedInstallmentPurchases({
      workspaceId: "workspace-1",
      userId: "user-1",
      seed,
      categoryIdByKey,
      paymentMethodIdByKey,
    });

    const transferRows = rows.filter((row) => row.transfer_group_id !== null);
    expect(transferRows).toHaveLength(4);
    const transferRowsByGroup = new Map<string, typeof transferRows>();
    for (const row of transferRows) {
      const transferGroupId = row.transfer_group_id as string;
      const existingRows = transferRowsByGroup.get(transferGroupId) ?? [];
      transferRowsByGroup.set(transferGroupId, [...existingRows, row]);
    }

    expect(Array.from(transferRowsByGroup.values()).map((groupRows) => groupRows.length).sort()).toEqual([
      2,
      2,
    ]);
    for (const groupRows of transferRowsByGroup.values()) {
      expect(groupRows.map((row) => row.direction).sort()).toEqual(["in", "out"]);
    }
    expect(transferRows.every((row) => row.type === "transfer")).toBe(true);

    const purchaseIds = new Set(installmentPurchases.map((purchase) => purchase.id));
    const installmentRows = rows.filter((row) => row.installment_purchase_id !== null);
    expect(installmentPurchases).toHaveLength(2);
    expect(installmentRows).toHaveLength(12);
    expect(
      installmentRows.every(
        (row) => row.installment_purchase_id !== null && purchaseIds.has(row.installment_purchase_id),
      ),
    ).toBe(true);
  });

  it("materializes budget periods and items aligned with visible demo movements", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));
    const categoryIdByKey = Object.fromEntries(
      Array.from(new Set(seed.transactions.map((transaction) => transaction.categoryKey))).map((key) => [
        key,
        `category-${key}`,
      ]),
    );

    const budget = materializeDemoSeedBudget({
      workspaceId: "workspace-1",
      userId: "user-1",
      seed,
      categoryIdByKey,
    });

    expect(budget.periods).toHaveLength(2);
    expect(
      budget.periods
        .map((period) => `${period.year}-${String(period.month).padStart(2, "0")}`)
        .sort(),
    ).toEqual(["2026-03", "2026-04"]);

    const periodMonthById = new Map(
      budget.periods.map((period) => [period.id as string, period.month]),
    );
    const categoryKeyById = new Map(
      Object.entries(categoryIdByKey).map(([key, categoryId]) => [categoryId, key]),
    );
    const byMonthAndCategory = new Map<string, number>();

    for (const item of budget.items) {
      const month = periodMonthById.get(item.budget_period_id);
      const categoryKey = categoryKeyById.get(item.category_id);
      if (!month || !categoryKey) {
        continue;
      }

      byMonthAndCategory.set(`${month}|${categoryKey}`, Number(item.amount));
    }

    expect(byMonthAndCategory.get("3|income_salary")).toBe(1_750_000);
    expect(byMonthAndCategory.get("3|expense_utilities")).toBe(110_000);
    expect(byMonthAndCategory.get("4|expense_utilities")).toBe(110_000);
    expect(byMonthAndCategory.get("3|expense_other")).toBe(270_000);
    expect(byMonthAndCategory.get("4|expense_other")).toBe(260_000);

    expect(Array.from(byMonthAndCategory.keys()).some((key) => key.endsWith("|credit_card_payment"))).toBe(
      false,
    );
    expect(Array.from(byMonthAndCategory.keys()).some((key) => key.endsWith("|cash_withdrawal"))).toBe(
      false,
    );
    expect(Array.from(byMonthAndCategory.keys()).some((key) => key.endsWith("|balance_adjustment"))).toBe(
      false,
    );
  });
});
