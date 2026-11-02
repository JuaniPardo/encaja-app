import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import {
  createTransactionFormSchema,
  type TransactionFormInputValues,
} from "@/features/transactions/schema";

const messages = {
  requiredCategory: "test: categoría obligatoria",
  amountGtZero: "test: monto mayor a cero",
  requiredTransactionDate: "test: fecha obligatoria",
  installmentsCountMax: "test: demasiadas cuotas",
};

const validValues: TransactionFormInputValues = {
  type: "expense",
  categoryId: "11111111-1111-4111-8111-111111111111",
  amount: "2500",
  transactionDate: "2026-04-20",
  effectiveDate: "",
  paymentMethodId: "22222222-2222-4222-8222-222222222222",
  installmentsCount: undefined,
  subcategoryId: "",
  description: "Compra",
  notes: "",
};

function resolve(values: TransactionFormInputValues) {
  const resolver = zodResolver(createTransactionFormSchema(messages));

  return resolver(values, undefined, { fields: {}, shouldUseNativeValidation: false });
}

describe("zodResolver with createTransactionFormSchema", () => {
  it("maps schema failures to field errors with the configured messages", async () => {
    const result = await resolve({
      ...validValues,
      categoryId: "",
      amount: "0",
      transactionDate: "",
      installmentsCount: 121,
    });

    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      categoryId: { message: messages.requiredCategory },
      amount: { message: messages.amountGtZero },
      transactionDate: { message: messages.requiredTransactionDate },
      installmentsCount: { message: messages.installmentsCountMax },
    });
  });

  it("returns the transformed values when the input is valid", async () => {
    const result = await resolve(validValues);

    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({
      amount: 2500,
      effectiveDate: null,
      subcategoryId: null,
      installmentsCount: 1,
      notes: null,
    });
  });
});
