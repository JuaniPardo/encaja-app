import { describe, expect, it } from "vitest";

import { isBudgetCategoryCritical, resolveBudgetLineStatus } from "@/features/budget/line-status";

describe("resolveBudgetLineStatus", () => {
  it("shows an income above its budget as a positive overrun", () => {
    expect(resolveBudgetLineStatus("income", 10000, 10800)).toEqual({
      percent: 108,
      clampedPercent: 100,
      isOver: true,
      tone: "overPositive",
    });
  });

  it("keeps an income below its budget within range", () => {
    expect(resolveBudgetLineStatus("income", 10000, 9000)).toEqual({
      percent: 90,
      clampedPercent: 90,
      isOver: false,
      tone: "within",
    });
  });

  it("shows an expense above its budget as a negative overrun", () => {
    expect(resolveBudgetLineStatus("expense", 10000, 10800)).toEqual({
      percent: 108,
      clampedPercent: 100,
      isOver: true,
      tone: "overNegative",
    });
  });

  it("keeps a saving above its budget as a negative overrun", () => {
    expect(resolveBudgetLineStatus("saving", 5000, 6000).tone).toBe("overNegative");
  });

  it("treats an exact match as within budget", () => {
    expect(resolveBudgetLineStatus("expense", 10000, 10000)).toMatchObject({
      percent: 100,
      isOver: false,
      tone: "within",
    });
  });

  it("returns 100 when there is actual amount without a budget", () => {
    expect(resolveBudgetLineStatus("expense", 0, 2500)).toEqual({
      percent: 100,
      clampedPercent: 100,
      isOver: false,
      tone: "within",
    });
  });

  it("returns 0 when there is neither budget nor actual amount", () => {
    expect(resolveBudgetLineStatus("income", 0, 0)).toEqual({
      percent: 0,
      clampedPercent: 0,
      isOver: false,
      tone: "within",
    });
  });

  it("rounds the percent and clamps it at 100", () => {
    expect(resolveBudgetLineStatus("expense", 3000, 1000).percent).toBe(33);
    expect(resolveBudgetLineStatus("expense", 1000, 2500)).toMatchObject({
      percent: 250,
      clampedPercent: 100,
    });
  });
});

describe("isBudgetCategoryCritical", () => {
  it("never flags an income as critical", () => {
    expect(isBudgetCategoryCritical("income", 10000, 10800)).toBe(false);
    expect(isBudgetCategoryCritical("income", 10000, 8000)).toBe(false);
  });

  it("flags an expense from 80% of its budget", () => {
    expect(isBudgetCategoryCritical("expense", 10000, 8000)).toBe(true);
    expect(isBudgetCategoryCritical("expense", 10000, 7900)).toBe(false);
  });

  it("keeps flagging savings as today", () => {
    expect(isBudgetCategoryCritical("saving", 10000, 8000)).toBe(true);
  });

  it("does not flag a category without budget", () => {
    expect(isBudgetCategoryCritical("expense", 0, 5000)).toBe(false);
  });
});
