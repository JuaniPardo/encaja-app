import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createWorkspaceForUser,
  deleteWorkspaceForUser,
} from "@/lib/workspace/bootstrap";
import type { Database } from "@/types/database";

function buildSupabaseMock() {
  const upsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ upsert }));
  const rpc = vi.fn(async () => ({
    error: null,
    data: [
      {
        workspace_id: "workspace-1",
        workspace_name: "Hogar",
        workspace_slug: "hogar",
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
    });
    expect(workspace).toMatchObject({
      id: "workspace-1",
      name: "Hogar",
      slug: "hogar",
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
});
