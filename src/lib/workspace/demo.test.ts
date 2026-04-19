import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  BALANCE_ADJUSTMENT_SYSTEM_KEY,
  buildDemoPaymentMethodRows,
  createDemoPaymentMethods,
  resolveBalanceAdjustmentCategoryForWorkspace,
} from "@/lib/workspace/demo";
import type { Database } from "@/types/database";

type PaymentMethodRow = Pick<
  Database["public"]["Tables"]["payment_methods"]["Row"],
  "id" | "name" | "type" | "current_balance"
>;
type SystemCategoryRow = Pick<Database["public"]["Tables"]["system_categories"]["Row"], "id" | "key">;
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "type" | "is_active" | "is_exceptional" | "warning_message"
>;

function buildSupabaseMock(options?: {
  paymentMethodRows?: PaymentMethodRow[];
  systemCategoriesByKey?: Record<string, SystemCategoryRow | null>;
  workspaceCategory?: CategoryRow | null;
}) {
  const paymentMethodsSelect = vi.fn(async () => ({
    error: null,
    data: options?.paymentMethodRows ?? [],
  }));
  const paymentMethodsInsert = vi.fn(() => ({ select: paymentMethodsSelect }));

  const systemCategoriesEq = vi.fn((_: string, key: string) => ({
    maybeSingle: vi.fn(async () => ({
      error: null,
      data: options?.systemCategoriesByKey?.[key] ?? null,
    })),
  }));
  const systemCategoriesSelect = vi.fn(() => ({ eq: systemCategoriesEq }));

  const categoriesQueryBuilder = {
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      error: null,
      data: options?.workspaceCategory ?? null,
    })),
  };
  categoriesQueryBuilder.eq.mockImplementation(() => categoriesQueryBuilder);

  const categoriesSelect = vi.fn(() => categoriesQueryBuilder);

  const from = vi.fn((table: string) => {
    if (table === "payment_methods") {
      return {
        insert: paymentMethodsInsert,
      };
    }

    if (table === "system_categories") {
      return {
        select: systemCategoriesSelect,
      };
    }

    if (table === "categories") {
      return {
        select: categoriesSelect,
      };
    }

    return {};
  });

  return {
    supabase: {
      from,
    } as unknown as SupabaseClient<Database>,
    from,
    paymentMethodsInsert,
    paymentMethodsSelect,
    systemCategoriesSelect,
    systemCategoriesEq,
    categoriesSelect,
    categoriesQueryBuilder,
  };
}

describe("workspace demo helpers", () => {
  it("builds exactly 3 demo payment methods with zero balance", () => {
    const rows = buildDemoPaymentMethodRows("workspace-1", "user-1");

    expect(rows).toHaveLength(3);
    expect(rows).toEqual([
      expect.objectContaining({
        workspace_id: "workspace-1",
        created_by: "user-1",
        name: "Tarjeta de Débito",
        type: "debit_card",
        current_balance: 0,
      }),
      expect.objectContaining({
        workspace_id: "workspace-1",
        created_by: "user-1",
        name: "Efectivo",
        type: "cash",
        current_balance: 0,
      }),
      expect.objectContaining({
        workspace_id: "workspace-1",
        created_by: "user-1",
        name: "Tarjeta de Crédito",
        type: "credit_card",
        current_balance: 0,
      }),
    ]);
  });

  it("creates and maps demo payment methods by key", async () => {
    const { supabase, paymentMethodsInsert } = buildSupabaseMock({
      paymentMethodRows: [
        { id: "pm-credit", name: "Tarjeta de Crédito", type: "credit_card", current_balance: 0 },
        { id: "pm-debit", name: "Tarjeta de Débito", type: "debit_card", current_balance: 0 },
        { id: "pm-cash", name: "Efectivo", type: "cash", current_balance: 0 },
      ],
    });

    const result = await createDemoPaymentMethods({
      supabase,
      workspaceId: "workspace-1",
      userId: "user-1",
    });

    expect(paymentMethodsInsert).toHaveBeenCalledOnce();
    expect(result.debit.id).toBe("pm-debit");
    expect(result.cash.id).toBe("pm-cash");
    expect(result.credit.id).toBe("pm-credit");
  });

  it("resolves balance_adjustment system category when available", async () => {
    const { supabase } = buildSupabaseMock({
      systemCategoriesByKey: {
        [BALANCE_ADJUSTMENT_SYSTEM_KEY]: {
          id: "system-balance-adjustment",
          key: BALANCE_ADJUSTMENT_SYSTEM_KEY,
        },
      },
      workspaceCategory: {
        id: "category-balance-adjustment",
        type: "expense",
        is_active: true,
        is_exceptional: true,
        warning_message: "Warning",
      },
    });

    const result = await resolveBalanceAdjustmentCategoryForWorkspace({
      supabase,
      workspaceId: "workspace-1",
    });

    expect(result).toEqual({
      categoryId: "category-balance-adjustment",
      systemKey: BALANCE_ADJUSTMENT_SYSTEM_KEY,
    });
  });

  it("falls back to legacy balance-adjustment key", async () => {
    const { supabase } = buildSupabaseMock({
      systemCategoriesByKey: {
        expense_manual_adjustment: {
          id: "system-legacy-adjustment",
          key: "expense_manual_adjustment",
        },
      },
      workspaceCategory: {
        id: "category-legacy-adjustment",
        type: "expense",
        is_active: true,
        is_exceptional: true,
        warning_message: "Warning",
      },
    });

    const result = await resolveBalanceAdjustmentCategoryForWorkspace({
      supabase,
      workspaceId: "workspace-1",
    });

    expect(result).toEqual({
      categoryId: "category-legacy-adjustment",
      systemKey: "expense_manual_adjustment",
    });
  });

  it("requires balance_adjustment warning metadata", async () => {
    const { supabase } = buildSupabaseMock({
      systemCategoriesByKey: {
        [BALANCE_ADJUSTMENT_SYSTEM_KEY]: {
          id: "system-balance-adjustment",
          key: BALANCE_ADJUSTMENT_SYSTEM_KEY,
        },
      },
      workspaceCategory: {
        id: "category-balance-adjustment",
        type: "expense",
        is_active: true,
        is_exceptional: false,
        warning_message: null,
      },
    });

    await expect(
      resolveBalanceAdjustmentCategoryForWorkspace({
        supabase,
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("La categoría balance_adjustment debe tener warning y flag excepcional.");
  });
});
