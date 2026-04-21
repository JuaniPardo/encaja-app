import { describe, expect, it } from "vitest";

import { transactionFormSchema } from "@/features/transactions/schema";

const validCategoryId = "11111111-1111-4111-8111-111111111111";
const validPaymentMethodId = "22222222-2222-4222-8222-222222222222";

describe("transactionFormSchema", () => {
  it("defaults installments count to 1 when omitted", () => {
    const parsed = transactionFormSchema.parse({
      type: "expense",
      categoryId: validCategoryId,
      amount: "2500",
      transactionDate: "2026-04-20",
      effectiveDate: "",
      paymentMethodId: validPaymentMethodId,
      description: "Compra",
      notes: "",
    });

    expect(parsed.installmentsCount).toBe(1);
  });

  it("parses installments count as integer", () => {
    const parsed = transactionFormSchema.parse({
      type: "expense",
      categoryId: validCategoryId,
      amount: "2500",
      transactionDate: "2026-04-20",
      effectiveDate: "",
      paymentMethodId: validPaymentMethodId,
      installmentsCount: "6",
      description: "Compra",
      notes: "",
    });

    expect(parsed.installmentsCount).toBe(6);
  });

  it("rejects installments count lower than minimum", () => {
    const result = transactionFormSchema.safeParse({
      type: "expense",
      categoryId: validCategoryId,
      amount: "2500",
      transactionDate: "2026-04-20",
      effectiveDate: "",
      paymentMethodId: validPaymentMethodId,
      installmentsCount: 0,
      description: "Compra",
      notes: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects installments count above maximum", () => {
    const result = transactionFormSchema.safeParse({
      type: "expense",
      categoryId: validCategoryId,
      amount: "2500",
      transactionDate: "2026-04-20",
      effectiveDate: "",
      paymentMethodId: validPaymentMethodId,
      installmentsCount: 121,
      description: "Compra",
      notes: "",
    });

    expect(result.success).toBe(false);
  });
});
