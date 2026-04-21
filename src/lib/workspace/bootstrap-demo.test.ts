import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace/demo", () => ({
  BALANCE_ADJUSTMENT_SYSTEM_KEY: "balance_adjustment",
  createDemoPaymentMethods: vi.fn(),
  resolveBalanceAdjustmentCategoryForWorkspace: vi.fn(),
}));

vi.mock("@/lib/workspace/demo-seed", () => ({
  buildDemoSeed: vi.fn(),
  materializeDemoSeedInstallmentPurchases: vi.fn(),
  materializeDemoSeedTransactions: vi.fn(),
}));

import {
  createDemoPaymentMethods,
  resolveBalanceAdjustmentCategoryForWorkspace,
} from "@/lib/workspace/demo";
import {
  buildDemoSeed,
  materializeDemoSeedInstallmentPurchases,
  materializeDemoSeedTransactions,
} from "@/lib/workspace/demo-seed";
import { createDemoWorkspaceForUser } from "@/lib/workspace/bootstrap";
import type { Database } from "@/types/database";

function buildSupabaseMock(options?: {
  existingDemo?: boolean;
  systemCategoryRows?: Array<{ id: string; key: string }>;
  workspaceCategoryRows?: Array<{ id: string; system_category_id: string | null }>;
  transactionsInsertError?: { message: string } | null;
}) {
  const upsert = vi.fn(async () => ({ error: null }));

  const workspacesLimit = vi.fn(async () => ({
    error: null,
    data: options?.existingDemo ? [{ id: "workspace-demo" }] : [],
  }));
  const workspacesEqIsDemo = vi.fn(() => ({ limit: workspacesLimit }));
  const workspacesEqCreatedBy = vi.fn(() => ({ eq: workspacesEqIsDemo }));
  const workspacesSelect = vi.fn(() => ({ eq: workspacesEqCreatedBy }));

  const systemCategoriesIn = vi.fn(async () => ({
    error: null,
    data: options?.systemCategoryRows ?? [{ id: "system-balance", key: "balance_adjustment" }],
  }));
  const systemCategoriesSelect = vi.fn(() => ({ in: systemCategoriesIn }));

  const categoriesIn = vi.fn(async () => ({
    error: null,
    data: options?.workspaceCategoryRows ?? [{ id: "category-balance", system_category_id: "system-balance" }],
  }));
  const categoriesEqSource = vi.fn(() => ({ in: categoriesIn }));
  const categoriesEqWorkspace = vi.fn(() => ({ eq: categoriesEqSource }));
  const categoriesSelect = vi.fn(() => ({ eq: categoriesEqWorkspace }));

  const transactionsInsert = vi.fn(async () => ({
    error: options?.transactionsInsertError ?? null,
  }));
  const installmentPurchasesInsert = vi.fn(async () => ({
    error: null,
  }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { upsert };
    }

    if (table === "workspaces") {
      return { select: workspacesSelect };
    }

    if (table === "system_categories") {
      return { select: systemCategoriesSelect };
    }

    if (table === "categories") {
      return { select: categoriesSelect };
    }

    if (table === "transactions") {
      return { insert: transactionsInsert };
    }

    if (table === "installment_purchases") {
      return { insert: installmentPurchasesInsert };
    }

    return {};
  });

  const rpc = vi.fn(async (rpcName: string) => {
    if (rpcName === "create_workspace_with_defaults") {
      return {
        error: null,
        data: [
          {
            workspace_id: "workspace-demo",
            workspace_name: "Caja Demo",
            workspace_slug: "caja-demo",
            workspace_is_demo: true,
            workspace_role: "owner",
            subscription_plan: "premium",
            subscription_status: "active",
          },
        ],
      };
    }

    if (rpcName === "delete_workspace") {
      return {
        error: null,
        data: [
          {
            deleted_workspace_id: "workspace-demo",
            deleted_workspace_slug: "caja-demo",
          },
        ],
      };
    }

    return {
      error: null,
      data: [],
    };
  });

  return {
    supabase: {
      from,
      rpc,
    } as unknown as SupabaseClient<Database>,
    rpc,
    transactionsInsert,
    installmentPurchasesInsert,
  };
}

describe("createDemoWorkspaceForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createDemoPaymentMethods).mockResolvedValue({
      debit: {
        id: "payment-method-debit",
        name: "Tarjeta de Débito",
        type: "debit_card",
        current_balance: 0,
      },
      cash: {
        id: "payment-method-cash",
        name: "Efectivo",
        type: "cash",
        current_balance: 0,
      },
      credit: {
        id: "payment-method-credit",
        name: "Tarjeta de Crédito",
        type: "credit_card",
        current_balance: 0,
      },
    });

    vi.mocked(resolveBalanceAdjustmentCategoryForWorkspace).mockResolvedValue({
      categoryId: "category-balance",
      systemKey: "balance_adjustment",
    });

    vi.mocked(buildDemoSeed).mockReturnValue({
      referenceDate: "2026-04-19",
      previousMonthAnchor: "2026-03-01",
      currentMonthAnchor: "2026-04-01",
      installmentPurchases: [
        {
          key: "installment_purchase_cellphone_previous",
          purchaseDate: "2026-03-22",
          effectiveDate: null,
          firstInstallmentDate: "2026-03-01",
          categoryKey: "balance_adjustment",
          paymentMethodKey: "credit",
          totalAmount: 780000,
          installmentsCount: 6,
          description: "Celular",
          notes: null,
        },
      ],
      transactions: [
        {
          key: "adjustment_debit_previous",
          transactionDate: "2026-03-01",
          effectiveDate: null,
          type: "expense",
          categoryKey: "balance_adjustment",
          paymentMethodKey: "debit",
          amount: 180000,
          description: "Ajuste inicial",
          notes: null,
          transferGroupKey: null,
          direction: null,
          installmentPurchaseKey: null,
          installmentNumber: null,
          installmentCount: null,
        },
      ],
    });

    vi.mocked(materializeDemoSeedInstallmentPurchases).mockReturnValue([
      {
        id: "installment-purchase-1",
        workspace_id: "workspace-demo",
        payment_method_id: "payment-method-credit",
        category_id: "category-balance",
        purchase_date: "2026-03-22",
        effective_date: null,
        first_installment_date: "2026-03-01",
        total_amount: 780000,
        installments_count: 6,
        description: "Celular",
        notes: null,
        created_by: "user-1",
      },
    ]);

    vi.mocked(materializeDemoSeedTransactions).mockReturnValue([
      {
        workspace_id: "workspace-demo",
        transaction_date: "2026-03-01",
        effective_date: null,
        type: "expense",
        transfer_group_id: null,
        direction: null,
        installment_purchase_id: null,
        installment_number: null,
        installment_count: null,
        category_id: "category-balance",
        payment_method_id: "payment-method-debit",
        amount: 180000,
        description: "Ajuste inicial",
        notes: null,
        is_recurring: false,
        created_by: "user-1",
      },
    ]);
  });

  it("creates a demo workspace end-to-end", async () => {
    const { supabase, rpc, transactionsInsert, installmentPurchasesInsert } = buildSupabaseMock();
    const user = {
      id: "user-1",
      email: "owner@encaja.app",
    } as User;

    const workspace = await createDemoWorkspaceForUser({
      supabase,
      user,
      name: "Caja Demo",
    });

    expect(rpc).toHaveBeenCalledWith("create_workspace_with_defaults", {
      p_workspace_name: "Caja Demo",
      p_is_demo: true,
    });
    expect(installmentPurchasesInsert).toHaveBeenCalledOnce();
    expect(transactionsInsert).toHaveBeenCalledOnce();
    expect(workspace).toMatchObject({
      id: "workspace-demo",
      slug: "caja-demo",
      isDemo: true,
    });
  });

  it("blocks a second active demo workspace", async () => {
    const { supabase, rpc } = buildSupabaseMock({ existingDemo: true });
    const user = {
      id: "user-1",
      email: "owner@encaja.app",
    } as User;

    await expect(
      createDemoWorkspaceForUser({
        supabase,
        user,
        name: "Caja Demo",
      }),
    ).rejects.toThrow("Ya tenés una Caja Demo activa.");

    expect(rpc).not.toHaveBeenCalledWith("create_workspace_with_defaults", {
      p_workspace_name: "Caja Demo",
      p_is_demo: true,
    });
  });

  it("rolls back demo workspace when a later step fails", async () => {
    const { supabase, rpc } = buildSupabaseMock({
      transactionsInsertError: {
        message: "insert failed",
      },
    });
    const user = {
      id: "user-1",
      email: "owner@encaja.app",
    } as User;

    await expect(
      createDemoWorkspaceForUser({
        supabase,
        user,
        name: "Caja Demo",
      }),
    ).rejects.toThrow("insert failed");

    expect(rpc).toHaveBeenCalledWith("delete_workspace", {
      p_workspace_id: "workspace-demo",
    });
  });
});
