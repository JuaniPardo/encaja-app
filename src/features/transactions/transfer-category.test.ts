import { describe, expect, it } from "vitest";

import { resolveTransferSystemCategoryKey } from "@/features/transactions/transfer-category";

describe("resolveTransferSystemCategoryKey", () => {
  it("resolves transfer matrix combinations", () => {
    expect(resolveTransferSystemCategoryKey("debit_card", "cash")).toBe("cash_withdrawal");
    expect(resolveTransferSystemCategoryKey("cash", "debit_card")).toBe("cash_deposit");
    expect(resolveTransferSystemCategoryKey("debit_card", "credit_card")).toBe("credit_card_payment");
    expect(resolveTransferSystemCategoryKey("cash", "credit_card")).toBe("credit_card_payment");
    expect(resolveTransferSystemCategoryKey("debit_card", "debit_card")).toBe("transfer");
    expect(resolveTransferSystemCategoryKey("cash", "cash")).toBe("transfer");
  });

  it("rejects credit card as transfer source", () => {
    expect(() => resolveTransferSystemCategoryKey("credit_card", "cash")).toThrow(
      "Invalid transfer: credit card cannot be source.",
    );
  });
});
