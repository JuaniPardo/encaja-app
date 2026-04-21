import { describe, expect, it } from "vitest";

import { resolveOperationalDate } from "@/features/transactions/utils";

describe("resolveOperationalDate", () => {
  it("uses transaction_date for first installment", () => {
    const result = resolveOperationalDate({
      effective_date: "2026-04-01",
      transaction_date: "2026-04-20",
      installment_purchase_id: "11111111-1111-4111-8111-111111111111",
      installment_number: 1,
      installment_count: 6,
    });

    expect(result).toBe("2026-04-20");
  });

  it("uses effective_date for subsequent installments", () => {
    const result = resolveOperationalDate({
      effective_date: "2026-05-01",
      transaction_date: "2026-04-20",
      installment_purchase_id: "11111111-1111-4111-8111-111111111111",
      installment_number: 2,
      installment_count: 6,
    });

    expect(result).toBe("2026-05-01");
  });

  it("falls back to transaction_date when effective_date is null", () => {
    const result = resolveOperationalDate({
      effective_date: null,
      transaction_date: "2026-04-20",
      installment_purchase_id: null,
      installment_number: null,
      installment_count: null,
    });

    expect(result).toBe("2026-04-20");
  });
});
