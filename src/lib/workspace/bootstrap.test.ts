import { PostgrestError, type SupabaseClient, type User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { UserFacingError } from "@/lib/errors/user-facing-error";
import {
  createWorkspaceForUser,
  deleteWorkspaceForUser,
} from "@/lib/workspace/bootstrap";
import type { Database } from "@/types/database";

type RpcRow =
  | Database["public"]["Functions"]["create_workspace_with_defaults"]["Returns"][number]
  | Database["public"]["Functions"]["delete_workspace"]["Returns"][number];

function buildSupabaseMock(options?: { existingDemo?: boolean }) {
  const upsert = vi.fn(async () => ({ error: null }));
  const workspacesLimit = vi.fn(async () => ({
    error: null,
    data: options?.existingDemo ? [{ id: "workspace-demo" }] : [],
  }));
  const workspacesEqIsDemo = vi.fn(() => ({ limit: workspacesLimit }));
  const workspacesEqCreatedBy = vi.fn(() => ({ eq: workspacesEqIsDemo }));
  const workspacesSelect = vi.fn(() => ({ eq: workspacesEqCreatedBy }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { upsert };
    }

    if (table === "workspaces") {
      return { select: workspacesSelect };
    }

    return {};
  });

  const rpc = vi.fn(async (): Promise<{ error: null; data: RpcRow[] }> => ({
    error: null,
    data: [
      {
        workspace_id: "workspace-1",
        workspace_name: "Hogar",
        workspace_slug: "hogar",
        workspace_is_demo: false,
        workspace_role: "owner",
        subscription_plan: "premium",
        subscription_status: "active",
      },
    ],
  }));

  return {
    supabase: {
      from,
      rpc,
    } as unknown as SupabaseClient<Database>,
    from,
    upsert,
    workspacesSelect,
    workspacesEqCreatedBy,
    workspacesEqIsDemo,
    workspacesLimit,
    rpc,
  };
}

describe("workspace bootstrap", () => {
  it("creates workspace through atomic RPC", async () => {
    const { supabase, rpc, from } = buildSupabaseMock();
    const user = {
      id: "user-1",
      email: "owner@encaja.app",
    } as User;

    const workspace = await createWorkspaceForUser({
      supabase,
      user,
      name: "Hogar",
    });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(rpc).toHaveBeenCalledWith("create_workspace_with_defaults", {
      p_workspace_name: "Hogar",
      p_is_demo: false,
    });
    expect(workspace).toMatchObject({
      id: "workspace-1",
      name: "Hogar",
      slug: "hogar",
      isDemo: false,
      role: "owner",
      subscription: {
        plan: "premium",
        status: "active",
      },
    });
  });

  it("deletes workspace through RPC", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    rpc.mockResolvedValueOnce({
      error: null,
      data: [
        {
          deleted_workspace_id: "workspace-1",
          deleted_workspace_slug: "hogar",
        },
      ],
    });

    const deletedWorkspace = await deleteWorkspaceForUser({
      supabase,
      workspaceId: "workspace-1",
    });

    expect(rpc).toHaveBeenCalledWith("delete_workspace", {
      p_workspace_id: "workspace-1",
    });
    expect(deletedWorkspace).toMatchObject({
      deleted_workspace_id: "workspace-1",
      deleted_workspace_slug: "hogar",
    });
  });

  it("rethrows the delete_workspace RPC error keeping its code", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    const rpcError = new PostgrestError({
      code: "P0001",
      message: "Solo el owner puede eliminar este workspace.",
      details: "",
      hint: "",
    });
    rpc.mockResolvedValueOnce({ error: rpcError, data: null } as never);

    const deletion = deleteWorkspaceForUser({ supabase, workspaceId: "workspace-1" });

    await expect(deletion).rejects.toBe(rpcError);
  });

  it("does not expose an internal message when delete_workspace returns no rows", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    rpc.mockResolvedValueOnce({ error: null, data: [] });

    const deletion = deleteWorkspaceForUser({ supabase, workspaceId: "workspace-1" });

    await expect(deletion).rejects.toThrow("delete_workspace returned no rows");
    await expect(deletion).rejects.not.toBeInstanceOf(UserFacingError);
  });

  it("rejects short workspace names with a user-facing error", async () => {
    const { supabase } = buildSupabaseMock();
    const user = { id: "user-1", email: "owner@encaja.app" } as User;

    const creation = createWorkspaceForUser({ supabase, user, name: "A" });

    await expect(creation).rejects.toBeInstanceOf(UserFacingError);
  });
});
