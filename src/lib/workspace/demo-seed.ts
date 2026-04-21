import type { Database, TransactionType } from "@/types/database";

import { BALANCE_ADJUSTMENT_SYSTEM_KEY, type DemoPaymentMethodKey } from "@/lib/workspace/demo";

type DemoSeedPeriod = "previous_month" | "current_month";

type DemoSeedTemplateEvent =
  | {
      key: string;
      period: DemoSeedPeriod;
      baseDay: number;
      type: Exclude<TransactionType, "transfer" | "saving">;
      categoryKey: string;
      paymentMethodKey: DemoPaymentMethodKey;
      amount: number;
      description?: string;
      notes?: string;
    }
  | {
      key: string;
      period: DemoSeedPeriod;
      baseDay: number;
      type: "transfer";
      categoryKey: string;
      fromPaymentMethodKey: DemoPaymentMethodKey;
      toPaymentMethodKey: DemoPaymentMethodKey;
      amount: number;
      description?: string;
      notes?: string;
    };

type DemoSeedInstallmentPurchaseTemplate = {
  key: string;
  period: DemoSeedPeriod;
  baseDay: number;
  categoryKey: string;
  paymentMethodKey: "credit";
  totalAmount: number;
  installmentsCount: number;
  description: string;
  notes?: string;
};

export interface DemoSeedInstallmentPurchaseDraft {
  key: string;
  purchaseDate: string;
  effectiveDate: string | null;
  firstInstallmentDate: string;
  categoryKey: string;
  paymentMethodKey: "credit";
  totalAmount: number;
  installmentsCount: number;
  description: string | null;
  notes: string | null;
}

export interface DemoSeedTransactionDraft {
  key: string;
  transactionDate: string;
  effectiveDate: string | null;
  type: TransactionType;
  categoryKey: string;
  paymentMethodKey: DemoPaymentMethodKey;
  amount: number;
  description: string | null;
  notes: string | null;
  transferGroupKey: string | null;
  direction: "in" | "out" | null;
  installmentPurchaseKey: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
}

export interface DemoSeedResult {
  referenceDate: string;
  previousMonthAnchor: string;
  currentMonthAnchor: string;
  installmentPurchases: DemoSeedInstallmentPurchaseDraft[];
  transactions: DemoSeedTransactionDraft[];
}

type MonthContext = {
  year: number;
  monthIndex: number;
  lastDay: number;
};

type DateBounds = {
  previousMonth: MonthContext;
  currentMonth: MonthContext;
  currentDay: number;
};

const previousMonthTemplates: DemoSeedTemplateEvent[] = [
  {
    key: "income_salary_previous",
    period: "previous_month",
    baseDay: 1,
    type: "income",
    categoryKey: "income_salary",
    paymentMethodKey: "debit",
    amount: 1_750_000,
    description: "Sueldo",
  },
  {
    key: "expense_rent_previous",
    period: "previous_month",
    baseDay: 5,
    type: "expense",
    categoryKey: "expense_rent",
    paymentMethodKey: "debit",
    amount: 520_000,
    description: "Alquiler y expensas",
  },
  {
    key: "expense_utilities_previous",
    period: "previous_month",
    baseDay: 7,
    type: "expense",
    categoryKey: "expense_utilities",
    paymentMethodKey: "debit",
    amount: 105_000,
    description: "Servicios",
  },
  {
    key: "expense_groceries_debit_previous",
    period: "previous_month",
    baseDay: 6,
    type: "expense",
    categoryKey: "expense_groceries",
    paymentMethodKey: "debit",
    amount: 210_000,
    description: "Supermercado",
  },
  {
    key: "expense_groceries_credit_previous",
    period: "previous_month",
    baseDay: 14,
    type: "expense",
    categoryKey: "expense_groceries",
    paymentMethodKey: "credit",
    amount: 190_000,
    description: "Supermercado (crédito)",
  },
  {
    key: "expense_cash_purchases_previous",
    period: "previous_month",
    baseDay: 10,
    type: "expense",
    categoryKey: "expense_groceries",
    paymentMethodKey: "cash",
    amount: 80_000,
    description: "Compras en efectivo",
  },
  {
    key: "transfer_cash_withdrawal_previous",
    period: "previous_month",
    baseDay: 4,
    type: "transfer",
    categoryKey: "cash_withdrawal",
    fromPaymentMethodKey: "debit",
    toPaymentMethodKey: "cash",
    amount: 230_000,
    description: "Extracción de efectivo",
  },
  {
    key: "expense_transport_previous",
    period: "previous_month",
    baseDay: 8,
    type: "expense",
    categoryKey: "expense_transport",
    paymentMethodKey: "debit",
    amount: 65_000,
    description: "Transporte",
  },
  {
    key: "expense_entertainment_previous",
    period: "previous_month",
    baseDay: 16,
    type: "expense",
    categoryKey: "expense_entertainment",
    paymentMethodKey: "cash",
    amount: 90_000,
    description: "Salidas y delivery",
  },
  {
    key: "expense_education_previous",
    period: "previous_month",
    baseDay: 15,
    type: "expense",
    categoryKey: "expense_education",
    paymentMethodKey: "debit",
    amount: 120_000,
    description: "Colegio y actividades",
  },
  {
    key: "expense_health_previous",
    period: "previous_month",
    baseDay: 18,
    type: "expense",
    categoryKey: "expense_health",
    paymentMethodKey: "debit",
    amount: 50_000,
    description: "Farmacia",
  },
  {
    key: "expense_shopping_previous",
    period: "previous_month",
    baseDay: 19,
    type: "expense",
    categoryKey: "expense_other",
    paymentMethodKey: "credit",
    amount: 140_000,
    description: "Shopping",
  },
  {
    key: "expense_subscription_end_previous",
    period: "previous_month",
    baseDay: 31,
    type: "expense",
    categoryKey: "expense_subscriptions",
    paymentMethodKey: "debit",
    amount: 20_000,
    description: "Suscripciones",
  },
];

const currentMonthTemplates: DemoSeedTemplateEvent[] = [
  {
    key: "income_salary_current",
    period: "current_month",
    baseDay: 1,
    type: "income",
    categoryKey: "income_salary",
    paymentMethodKey: "debit",
    amount: 1_750_000,
    description: "Sueldo",
  },
  {
    key: "transfer_card_payment_current",
    period: "current_month",
    baseDay: 3,
    type: "transfer",
    categoryKey: "credit_card_payment",
    fromPaymentMethodKey: "debit",
    toPaymentMethodKey: "credit",
    amount: 900_000,
    description: "Pago de tarjeta",
  },
  {
    key: "income_extra_current",
    period: "current_month",
    baseDay: 12,
    type: "income",
    categoryKey: "income_extra",
    paymentMethodKey: "cash",
    amount: 180_000,
    description: "Ingreso extra",
  },
  {
    key: "expense_rent_current",
    period: "current_month",
    baseDay: 5,
    type: "expense",
    categoryKey: "expense_rent",
    paymentMethodKey: "debit",
    amount: 520_000,
    description: "Alquiler y expensas",
  },
  {
    key: "expense_utilities_current",
    period: "current_month",
    baseDay: 7,
    type: "expense",
    categoryKey: "expense_utilities",
    paymentMethodKey: "debit",
    amount: 105_000,
    description: "Servicios",
  },
  {
    key: "expense_groceries_debit_current",
    period: "current_month",
    baseDay: 6,
    type: "expense",
    categoryKey: "expense_groceries",
    paymentMethodKey: "debit",
    amount: 200_000,
    description: "Supermercado",
  },
  {
    key: "expense_groceries_credit_current",
    period: "current_month",
    baseDay: 14,
    type: "expense",
    categoryKey: "expense_groceries",
    paymentMethodKey: "credit",
    amount: 180_000,
    description: "Supermercado (crédito)",
  },
  {
    key: "expense_cash_purchases_current",
    period: "current_month",
    baseDay: 10,
    type: "expense",
    categoryKey: "expense_groceries",
    paymentMethodKey: "cash",
    amount: 80_000,
    description: "Compras en efectivo",
  },
  {
    key: "expense_transport_current",
    period: "current_month",
    baseDay: 8,
    type: "expense",
    categoryKey: "expense_transport",
    paymentMethodKey: "debit",
    amount: 65_000,
    description: "Transporte",
  },
  {
    key: "expense_entertainment_current",
    period: "current_month",
    baseDay: 16,
    type: "expense",
    categoryKey: "expense_entertainment",
    paymentMethodKey: "cash",
    amount: 90_000,
    description: "Salidas y delivery",
  },
  {
    key: "expense_education_current",
    period: "current_month",
    baseDay: 15,
    type: "expense",
    categoryKey: "expense_education",
    paymentMethodKey: "debit",
    amount: 120_000,
    description: "Colegio y actividades",
  },
  {
    key: "expense_health_current",
    period: "current_month",
    baseDay: 18,
    type: "expense",
    categoryKey: "expense_health",
    paymentMethodKey: "debit",
    amount: 50_000,
    description: "Farmacia",
  },
  {
    key: "expense_shopping_current",
    period: "current_month",
    baseDay: 19,
    type: "expense",
    categoryKey: "expense_other",
    paymentMethodKey: "credit",
    amount: 70_000,
    description: "Shopping",
  },
  {
    key: "expense_subscription_end_current",
    period: "current_month",
    baseDay: 31,
    type: "expense",
    categoryKey: "expense_subscriptions",
    paymentMethodKey: "debit",
    amount: 20_000,
    description: "Suscripciones",
  },
];

const adjustmentTemplates: DemoSeedTemplateEvent[] = [
  {
    key: "adjustment_debit_previous",
    period: "previous_month",
    baseDay: 1,
    type: "expense",
    categoryKey: BALANCE_ADJUSTMENT_SYSTEM_KEY,
    paymentMethodKey: "debit",
    amount: 180_000,
    description: "Ajuste inicial",
    notes: "Saldo previo consumido",
  },
  {
    key: "adjustment_cash_previous",
    period: "previous_month",
    baseDay: 1,
    type: "expense",
    categoryKey: BALANCE_ADJUSTMENT_SYSTEM_KEY,
    paymentMethodKey: "cash",
    amount: 60_000,
    description: "Ajuste inicial",
    notes: "Efectivo previo utilizado",
  },
  {
    key: "adjustment_credit_previous",
    period: "previous_month",
    baseDay: 1,
    type: "expense",
    categoryKey: BALANCE_ADJUSTMENT_SYSTEM_KEY,
    paymentMethodKey: "credit",
    amount: 420_000,
    description: "Ajuste inicial",
    notes: "Deuda previa en tarjeta",
  },
];

const installmentPurchaseTemplates: DemoSeedInstallmentPurchaseTemplate[] = [
  {
    key: "installment_purchase_cellphone_previous",
    period: "previous_month",
    baseDay: 22,
    categoryKey: "expense_other",
    paymentMethodKey: "credit",
    totalAmount: 780_000,
    installmentsCount: 6,
    description: "Celular",
  },
  {
    key: "installment_purchase_clothing_current",
    period: "current_month",
    baseDay: 11,
    categoryKey: "expense_other",
    paymentMethodKey: "credit",
    totalAmount: 360_000,
    installmentsCount: 6,
    description: "Ropa",
  },
];

function toPadded(value: number) {
  return String(value).padStart(2, "0");
}

function toDateOnly(year: number, monthIndex: number, day: number) {
  return `${year}-${toPadded(monthIndex + 1)}-${toPadded(day)}`;
}

function getMonthContext(referenceDate: Date, offsetMonths: number): MonthContext {
  const anchor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + offsetMonths,
    1,
    12,
    0,
    0,
    0,
  );

  return {
    year: anchor.getFullYear(),
    monthIndex: anchor.getMonth(),
    lastDay: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate(),
  };
}

function buildDateBounds(referenceDate: Date): DateBounds {
  return {
    previousMonth: getMonthContext(referenceDate, -1),
    currentMonth: getMonthContext(referenceDate, 0),
    currentDay: referenceDate.getDate(),
  };
}

function resolveTransactionDay(baseDay: number, monthLastDay: number) {
  return Math.min(Math.max(1, Math.trunc(baseDay)), monthLastDay);
}

function shouldIncludeTemplate(
  template: { period: DemoSeedPeriod },
  resolvedDay: number,
  bounds: DateBounds,
) {
  if (template.period !== "current_month") {
    return true;
  }

  return resolvedDay <= bounds.currentDay;
}

function expandTemplate(
  template: DemoSeedTemplateEvent,
  transactionDate: string,
): DemoSeedTransactionDraft[] {
  if (template.type !== "transfer") {
    return [
      {
        key: template.key,
        transactionDate,
        effectiveDate: null,
        type: template.type,
        categoryKey: template.categoryKey,
        paymentMethodKey: template.paymentMethodKey,
        amount: template.amount,
        description: template.description ?? null,
        notes: template.notes ?? null,
        transferGroupKey: null,
        direction: null,
        installmentPurchaseKey: null,
        installmentNumber: null,
        installmentCount: null,
      },
    ];
  }

  return [
    {
      key: `${template.key}_out`,
      transactionDate,
      effectiveDate: null,
      type: "transfer",
      categoryKey: template.categoryKey,
      paymentMethodKey: template.fromPaymentMethodKey,
      amount: template.amount,
      description: template.description ?? null,
      notes: template.notes ?? null,
      transferGroupKey: template.key,
      direction: "out",
      installmentPurchaseKey: null,
      installmentNumber: null,
      installmentCount: null,
    },
    {
      key: `${template.key}_in`,
      transactionDate,
      effectiveDate: null,
      type: "transfer",
      categoryKey: template.categoryKey,
      paymentMethodKey: template.toPaymentMethodKey,
      amount: template.amount,
      description: template.description ?? null,
      notes: template.notes ?? null,
      transferGroupKey: template.key,
      direction: "in",
      installmentPurchaseKey: null,
      installmentNumber: null,
      installmentCount: null,
    },
  ];
}

function materializeTemplateEvents(
  templates: DemoSeedTemplateEvent[],
  bounds: DateBounds,
): DemoSeedTransactionDraft[] {
  return templates.flatMap((template) => {
    const month = template.period === "previous_month" ? bounds.previousMonth : bounds.currentMonth;
    const resolvedDay = resolveTransactionDay(template.baseDay, month.lastDay);

    if (!shouldIncludeTemplate(template, resolvedDay, bounds)) {
      return [];
    }

    const transactionDate = toDateOnly(month.year, month.monthIndex, resolvedDay);
    return expandTemplate(template, transactionDate);
  });
}

function resolveMonthContextByPeriod(period: DemoSeedPeriod, bounds: DateBounds) {
  return period === "previous_month" ? bounds.previousMonth : bounds.currentMonth;
}

function materializeInstallmentPurchaseDrafts(
  templates: DemoSeedInstallmentPurchaseTemplate[],
  bounds: DateBounds,
): DemoSeedInstallmentPurchaseDraft[] {
  return templates.flatMap((template) => {
    const month = resolveMonthContextByPeriod(template.period, bounds);
    const resolvedDay = resolveTransactionDay(template.baseDay, month.lastDay);

    if (!shouldIncludeTemplate(template, resolvedDay, bounds)) {
      return [];
    }

    return [
      {
        key: template.key,
        purchaseDate: toDateOnly(month.year, month.monthIndex, resolvedDay),
        effectiveDate: null,
        firstInstallmentDate: toDateOnly(month.year, month.monthIndex, 1),
        categoryKey: template.categoryKey,
        paymentMethodKey: template.paymentMethodKey,
        totalAmount: template.totalAmount,
        installmentsCount: template.installmentsCount,
        description: template.description,
        notes: template.notes ?? null,
      },
    ];
  });
}

function parseDateOnly(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map((part) => Number(part));
  return { year, month, day };
}

function addMonthsToDateOnly(dateOnly: string, monthsToAdd: number) {
  const { year, month, day } = parseDateOnly(dateOnly);
  const nextDate = new Date(year, month - 1 + monthsToAdd, day, 12, 0, 0, 0);
  return toDateOnly(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
}

function splitAmountIntoInstallments(totalAmount: number, installmentsCount: number) {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentsCount);
  const remainderCents = totalCents % installmentsCount;

  return Array.from({ length: installmentsCount }, (_, index) => {
    const cents = baseCents + (index < remainderCents ? 1 : 0);
    return cents / 100;
  });
}

function materializeInstallmentTransactions(
  installmentPurchases: DemoSeedInstallmentPurchaseDraft[],
): DemoSeedTransactionDraft[] {
  return installmentPurchases.flatMap((purchase) => {
    const installmentAmounts = splitAmountIntoInstallments(
      purchase.totalAmount,
      purchase.installmentsCount,
    );

    return installmentAmounts.flatMap((amount, index) => {
      const installmentNumber = index + 1;
      const effectiveDate = addMonthsToDateOnly(purchase.firstInstallmentDate, index);

      return [
        {
          key: `${purchase.key}_installment_${installmentNumber}`,
          transactionDate: purchase.purchaseDate,
          effectiveDate,
          type: "expense",
          categoryKey: purchase.categoryKey,
          paymentMethodKey: purchase.paymentMethodKey,
          amount,
          description: `${purchase.description ?? "Compra"} - cuota ${installmentNumber} de ${purchase.installmentsCount}`,
          notes: purchase.notes,
          transferGroupKey: null,
          direction: null,
          installmentPurchaseKey: purchase.key,
          installmentNumber,
          installmentCount: purchase.installmentsCount,
        },
      ];
    });
  });
}

function fnv1aHash(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function toStableUuid(seed: string) {
  const segments = ["a", "b", "c", "d"].map((prefix) =>
    fnv1aHash(`${prefix}:${seed}`).toString(16).padStart(8, "0"),
  );
  const hex = segments.join("");
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13)}`;
  const variantNibble = ((parseInt(versioned.slice(16, 17), 16) & 0x3) | 0x8).toString(16);

  return `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${variantNibble}${versioned.slice(17, 20)}-${versioned.slice(20, 32)}`;
}

function toInstallmentPurchaseId(seed: DemoSeedResult, purchaseKey: string) {
  return toStableUuid(`${seed.currentMonthAnchor}:installment:${purchaseKey}`);
}

export function buildDemoSeed(referenceDate: Date): DemoSeedResult {
  const safeReferenceDate = new Date(referenceDate);
  const bounds = buildDateBounds(safeReferenceDate);
  const installmentPurchases = materializeInstallmentPurchaseDrafts(
    installmentPurchaseTemplates,
    bounds,
  );

  const transactions = [
    ...materializeTemplateEvents(adjustmentTemplates, bounds),
    ...materializeTemplateEvents(previousMonthTemplates, bounds),
    ...materializeTemplateEvents(currentMonthTemplates, bounds),
    ...materializeInstallmentTransactions(installmentPurchases),
  ];

  return {
    referenceDate: toDateOnly(
      safeReferenceDate.getFullYear(),
      safeReferenceDate.getMonth(),
      safeReferenceDate.getDate(),
    ),
    previousMonthAnchor: toDateOnly(bounds.previousMonth.year, bounds.previousMonth.monthIndex, 1),
    currentMonthAnchor: toDateOnly(bounds.currentMonth.year, bounds.currentMonth.monthIndex, 1),
    installmentPurchases,
    transactions,
  };
}

export type DemoInstallmentPurchaseInsert =
  Database["public"]["Tables"]["installment_purchases"]["Insert"];
export type DemoTransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export function materializeDemoSeedInstallmentPurchases({
  workspaceId,
  userId,
  seed,
  categoryIdByKey,
  paymentMethodIdByKey,
}: {
  workspaceId: string;
  userId: string;
  seed: DemoSeedResult;
  categoryIdByKey: Record<string, string>;
  paymentMethodIdByKey: Record<DemoPaymentMethodKey, string>;
}): DemoInstallmentPurchaseInsert[] {
  return seed.installmentPurchases.map((draft) => {
    const categoryId = categoryIdByKey[draft.categoryKey];
    if (!categoryId) {
      throw new Error(`Missing category mapping for key: ${draft.categoryKey}`);
    }

    const paymentMethodId = paymentMethodIdByKey[draft.paymentMethodKey];
    if (!paymentMethodId) {
      throw new Error(`Missing payment method mapping for key: ${draft.paymentMethodKey}`);
    }

    return {
      id: toInstallmentPurchaseId(seed, draft.key),
      workspace_id: workspaceId,
      payment_method_id: paymentMethodId,
      category_id: categoryId,
      purchase_date: draft.purchaseDate,
      effective_date: draft.effectiveDate,
      first_installment_date: draft.firstInstallmentDate,
      total_amount: draft.totalAmount,
      installments_count: draft.installmentsCount,
      description: draft.description,
      notes: draft.notes,
      created_by: userId,
    };
  });
}

export function materializeDemoSeedTransactions({
  workspaceId,
  userId,
  seed,
  categoryIdByKey,
  paymentMethodIdByKey,
}: {
  workspaceId: string;
  userId: string;
  seed: DemoSeedResult;
  categoryIdByKey: Record<string, string>;
  paymentMethodIdByKey: Record<DemoPaymentMethodKey, string>;
}): DemoTransactionInsert[] {
  const transferGroupIdByKey = new Map<string, string>();

  return seed.transactions.map((draft) => {
    const categoryId = categoryIdByKey[draft.categoryKey];
    if (!categoryId) {
      throw new Error(`Missing category mapping for key: ${draft.categoryKey}`);
    }

    const paymentMethodId = paymentMethodIdByKey[draft.paymentMethodKey];
    if (!paymentMethodId) {
      throw new Error(`Missing payment method mapping for key: ${draft.paymentMethodKey}`);
    }

    let transferGroupId: string | null = null;
    if (draft.transferGroupKey) {
      const existingTransferGroupId = transferGroupIdByKey.get(draft.transferGroupKey);
      if (existingTransferGroupId) {
        transferGroupId = existingTransferGroupId;
      } else {
        transferGroupId = toStableUuid(`${seed.currentMonthAnchor}:${draft.transferGroupKey}`);
        transferGroupIdByKey.set(draft.transferGroupKey, transferGroupId);
      }
    }

    return {
      workspace_id: workspaceId,
      transaction_date: draft.transactionDate,
      effective_date: draft.effectiveDate,
      type: draft.type,
      transfer_group_id: transferGroupId,
      direction: draft.direction,
      installment_purchase_id: draft.installmentPurchaseKey
        ? toInstallmentPurchaseId(seed, draft.installmentPurchaseKey)
        : null,
      installment_number: draft.installmentNumber,
      installment_count: draft.installmentCount,
      category_id: categoryId,
      payment_method_id: paymentMethodId,
      amount: draft.amount,
      description: draft.description,
      notes: draft.notes,
      is_recurring: false,
      created_by: userId,
    };
  });
}
