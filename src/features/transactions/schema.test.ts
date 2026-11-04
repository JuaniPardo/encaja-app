import { describe, expect, it } from "vitest";

import { createTransactionFormSchema, transactionFormSchema } from "@/features/transactions/schema";

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

  it("accepts a single installment when installments are not required", () => {
    expect(transactionFormSchema.safeParse(buildInstallmentsInput(1)).success).toBe(true);
  });
});

function buildInstallmentsInput(installmentsCount: number) {
  return {
    type: "expense",
    categoryId: validCategoryId,
    amount: "2500",
    transactionDate: "2026-04-20",
    effectiveDate: "",
    paymentMethodId: validPaymentMethodId,
    installmentsCount,
    description: "Compra",
    notes: "",
  };
}

describe("createTransactionFormSchema with required installments", () => {
  const minForPurchaseMessage = "Una compra en cuotas necesita al menos 2 cuotas.";
  const schema = createTransactionFormSchema(
    { installmentsCountMinForPurchase: minForPurchaseMessage },
    { requireInstallments: true },
  );

  it("rejects a single installment on the installments field", () => {
    const result = schema.safeParse(buildInstallmentsInput(1));

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["installmentsCount"], message: minForPurchaseMessage }),
    ]);
  });

  it("accepts two installments", () => {
    expect(schema.safeParse(buildInstallmentsInput(2)).success).toBe(true);
  });

  it("keeps rejecting more than 120 installments", () => {
    expect(schema.safeParse(buildInstallmentsInput(121)).success).toBe(false);
  });
});
