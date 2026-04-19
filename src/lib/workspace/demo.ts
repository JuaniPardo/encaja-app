import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, PaymentMethodType } from "@/types/database";

export type DemoPaymentMethodKey = "debit" | "cash" | "credit";

const LEGACY_BALANCE_ADJUSTMENT_SYSTEM_KEY = "expense_manual_adjustment";
export const BALANCE_ADJUSTMENT_SYSTEM_KEY = "balance_adjustment";

type PaymentMethodInsert = Database["public"]["Tables"]["payment_methods"]["Insert"];
type PaymentMethodRow = Pick<
  Database["public"]["Tables"]["payment_methods"]["Row"],
  "id" | "name" | "type" | "current_balance"
>;
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "type" | "is_active" | "is_exceptional" | "warning_message"
>;
type SystemCategoryRow = Pick<Database["public"]["Tables"]["system_categories"]["Row"], "id" | "key">;

const demoPaymentMethodDefinitions: ReadonlyArray<{
  key: DemoPaymentMethodKey;
  name: string;
  type: PaymentMethodType;
}> = [
  { key: "debit", name: "Tarjeta de Débito", type: "debit_card" },
  { key: "cash", name: "Efectivo", type: "cash" },
  { key: "credit", name: "Tarjeta de Crédito", type: "credit_card" },
];

export interface DemoPaymentMethodsMap {
  debit: PaymentMethodRow;
  cash: PaymentMethodRow;
  credit: PaymentMethodRow;
}

export function buildDemoPaymentMethodRows(workspaceId: string, userId: string): PaymentMethodInsert[] {
  return demoPaymentMethodDefinitions.map((definition) => ({
    workspace_id: workspaceId,
    created_by: userId,
    name: definition.name,
    type: definition.type,
    current_balance: 0,
    include_in_balance: true,
  }));
}

function mapDemoPaymentMethods(rows: PaymentMethodRow[]): DemoPaymentMethodsMap {
  const byType = new Map(rows.map((row) => [row.type, row]));

  const debit = byType.get("debit_card");
  const cash = byType.get("cash");
  const credit = byType.get("credit_card");

  if (!debit || !cash || !credit) {
    throw new Error("No pudimos crear los 3 medios de pago demo requeridos.");
  }

  const allRows = [debit, cash, credit];
  if (allRows.some((row) => row.current_balance !== 0)) {
    throw new Error("Los medios de pago demo deben comenzar con saldo 0.");
  }

  return {
    debit,
    cash,
    credit,
  };
}

export async function createDemoPaymentMethods({
  supabase,
  workspaceId,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string;
}): Promise<DemoPaymentMethodsMap> {
  const paymentMethodsResponse = await supabase
    .from("payment_methods")
    .insert(buildDemoPaymentMethodRows(workspaceId, userId))
    .select("id, name, type, current_balance");

  if (paymentMethodsResponse.error) {
    throw paymentMethodsResponse.error;
  }

  const rows = (paymentMethodsResponse.data ?? []) as PaymentMethodRow[];
  return mapDemoPaymentMethods(rows);
}

async function findSystemCategoryByKey(
  supabase: SupabaseClient<Database>,
  key: string,
): Promise<SystemCategoryRow | null> {
  const response = await supabase
    .from("system_categories")
    .select("id, key")
    .eq("key", key)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return (response.data ?? null) as SystemCategoryRow | null;
}

export async function resolveBalanceAdjustmentCategoryForWorkspace({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
}) {
  const balanceAdjustmentSystemCategory = await findSystemCategoryByKey(
    supabase,
    BALANCE_ADJUSTMENT_SYSTEM_KEY,
  );

  const selectedSystemCategory =
    balanceAdjustmentSystemCategory ??
    (await findSystemCategoryByKey(supabase, LEGACY_BALANCE_ADJUSTMENT_SYSTEM_KEY));

  if (!selectedSystemCategory) {
    throw new Error("No existe la categoría sistema balance_adjustment.");
  }

  const categoryResponse = await supabase
    .from("categories")
    .select("id, type, is_active, is_exceptional, warning_message")
    .eq("workspace_id", workspaceId)
    .eq("source", "system")
    .eq("system_category_id", selectedSystemCategory.id)
    .eq("type", "expense")
    .maybeSingle();

  if (categoryResponse.error) {
    throw categoryResponse.error;
  }

  const category = (categoryResponse.data ?? null) as CategoryRow | null;
  if (!category) {
    throw new Error("No encontramos la categoría balance_adjustment en este workspace.");
  }

  if (!category.is_active) {
    throw new Error("La categoría balance_adjustment debe estar activa.");
  }

  if (!category.is_exceptional || !category.warning_message?.trim()) {
    throw new Error("La categoría balance_adjustment debe tener warning y flag excepcional.");
  }

  return {
    categoryId: category.id,
    systemKey: selectedSystemCategory.key,
  };
}
