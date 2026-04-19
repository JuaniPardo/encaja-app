import { describe, expect, it } from "vitest";

import { type DemoPaymentMethodKey } from "@/lib/workspace/demo";
import { buildDemoSeed, materializeDemoSeedTransactions } from "@/lib/workspace/demo-seed";

function getDayOfMonth(dateOnly: string) {
  return Number(dateOnly.slice(8, 10));
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

  it("creates exactly two linked transfer transactions", () => {
    const seed = buildDemoSeed(new Date("2026-04-19T12:00:00Z"));

    const transferRows = seed.transactions.filter(
      (transaction) => transaction.transferGroupKey === "transfer_card_payment_current",
    );

    expect(transferRows).toHaveLength(2);
    expect(transferRows.map((row) => row.direction).sort()).toEqual(["in", "out"]);
    expect(transferRows.every((row) => row.type === "transfer")).toBe(true);
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

    const transferRows = rows.filter((row) => row.transfer_group_id !== null);
    expect(transferRows).toHaveLength(2);
    expect(transferRows[0]?.transfer_group_id).toBe(transferRows[1]?.transfer_group_id);
    expect(transferRows.every((row) => row.type === "transfer")).toBe(true);
  });
});
