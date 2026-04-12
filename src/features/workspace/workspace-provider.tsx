"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Button, Center, Loader, Paper, Stack, Text } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";

import { canUseFeature, type WorkspaceFeature } from "@/features/billing/feature-access";
import {
  buildWorkspaceHref,
  getWorkspaceScopedSectionPath,
  getWorkspaceSlugFromPathname,
} from "@/features/workspace/routing";
import { LAST_WORKSPACE_SLUG_STORAGE_KEY } from "@/features/workspace/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  bootstrapUserWorkspace,
  createWorkspaceForUser,
  listUserWorkspaces,
  type WorkspaceSummary,
} from "@/lib/workspace/bootstrap";
import type { Database } from "@/types/database";

interface WorkspaceContextValue {
  supabase: SupabaseClient<Database>;
  user: User;
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  refreshWorkspace: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceSummary>;
  switchWorkspace: (workspaceSlug: string, sectionPath?: string) => void;
  canUseWorkspaceFeature: (feature: WorkspaceFeature) => boolean;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceState {
  isLoading: boolean;
  errorMessage: string | null;
  user: User | null;
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary | null;
}

function readLastWorkspaceSlug() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LAST_WORKSPACE_SLUG_STORAGE_KEY);
}

function rememberLastWorkspaceSlug(workspaceSlug: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_WORKSPACE_SLUG_STORAGE_KEY, workspaceSlug);
}

function pickActiveWorkspace(
  workspaces: WorkspaceSummary[],
  routeWorkspaceSlug: string | null,
): WorkspaceSummary | null {
  if (workspaces.length === 0) {
    return null;
  }

  if (routeWorkspaceSlug) {
    const fromRoute = workspaces.find((workspace) => workspace.slug === routeWorkspaceSlug);
    if (fromRoute) {
      return fromRoute;
    }
  }

  const rememberedWorkspaceSlug = readLastWorkspaceSlug();
  if (rememberedWorkspaceSlug) {
    const remembered = workspaces.find((workspace) => workspace.slug === rememberedWorkspaceSlug);
    if (remembered) {
      return remembered;
    }
  }

  return workspaces[0];
}

function buildFallbackWorkspacePath(pathname: string, workspaceSlug: string) {
  const maybeLegacySection = getWorkspaceSlugFromPathname(pathname);
  if (
    maybeLegacySection &&
    ["insights", "budget", "transactions", "categories", "payment-methods", "settings"].includes(
      maybeLegacySection,
    )
  ) {
    return buildWorkspaceHref(workspaceSlug, `/${maybeLegacySection}`);
  }

  const scopedSectionPath = getWorkspaceScopedSectionPath(pathname);
  return buildWorkspaceHref(workspaceSlug, scopedSectionPath);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeWorkspaceSlug = getWorkspaceSlugFromPathname(pathname ?? "");

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<WorkspaceState>({
    isLoading: true,
    errorMessage: null,
    user: null,
    workspaces: [],
    workspace: null,
  });

  const loadWorkspace = useCallback(async () => {
    const userResponse = await supabase.auth.getUser();
    if (userResponse.error || !userResponse.data.user) {
      await supabase.auth.signOut();
      setState({
        isLoading: false,
        errorMessage: null,
        user: null,
        workspaces: [],
        workspace: null,
      });
      router.replace("/login");
      return;
    }

    const user = userResponse.data.user;
    const fullNameFromMetadata =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : undefined;

    try {
      await bootstrapUserWorkspace({
        supabase,
        user,
        fullNameHint: fullNameFromMetadata,
      });

      const workspaces = await listUserWorkspaces({ supabase, user });
      const workspace = pickActiveWorkspace(workspaces, routeWorkspaceSlug);

      if (!workspace) {
        throw new Error("No encontramos un workspace asociado.");
      }

      setState({
        isLoading: false,
        errorMessage: null,
        user,
        workspaces,
        workspace,
      });

      rememberLastWorkspaceSlug(workspace.slug);

      if (routeWorkspaceSlug && routeWorkspaceSlug !== workspace.slug) {
        router.replace(buildFallbackWorkspacePath(pathname ?? "/app", workspace.slug));
      }
    } catch (error) {
      setState({
        isLoading: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "No pudimos inicializar el workspace.",
        user,
        workspaces: [],
        workspace: null,
      });
    }
  }, [pathname, routeWorkspaceSlug, router, supabase]);

  const refreshWorkspace = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
    await loadWorkspace();
  }, [loadWorkspace]);

  const createWorkspace = useCallback(
    async (name: string) => {
      if (!state.user) {
        throw new Error("Tu sesión no está disponible.");
      }

      const createdWorkspace = await createWorkspaceForUser({
        supabase,
        user: state.user,
        name,
      });

      const workspaces = await listUserWorkspaces({
        supabase,
        user: state.user,
      });

      setState((prev) => ({
        ...prev,
        workspaces,
        workspace: createdWorkspace,
      }));

      rememberLastWorkspaceSlug(createdWorkspace.slug);
      return createdWorkspace;
    },
    [state.user, supabase],
  );

  const switchWorkspace = useCallback(
    (workspaceSlug: string, sectionPath = "") => {
      const nextWorkspace = state.workspaces.find((workspace) => workspace.slug === workspaceSlug);
      if (nextWorkspace) {
        setState((prev) => ({ ...prev, workspace: nextWorkspace }));
      }
      rememberLastWorkspaceSlug(workspaceSlug);
      router.push(buildWorkspaceHref(workspaceSlug, sectionPath));
    },
    [router, state.workspaces],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      isLoading: false,
      errorMessage: null,
      user: null,
      workspaces: [],
      workspace: null,
    });
    router.replace("/login");
  }, [router, supabase]);

  useEffect(() => {
    void loadWorkspace();

    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({
          isLoading: false,
          errorMessage: null,
          user: null,
          workspaces: [],
          workspace: null,
        });
        router.replace("/login");
        return;
      }

      void refreshWorkspace();
    });

    return () => {
      authListener.data.subscription.unsubscribe();
    };
  }, [loadWorkspace, refreshWorkspace, router, supabase.auth]);

  if (state.isLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Preparando tus workspaces...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (state.errorMessage || !state.user || !state.workspace) {
    return (
      <Center h="100vh" p="md">
        <Paper withBorder radius="md" p="lg" maw={480}>
          <Stack gap="sm">
            <Text fw={600}>No pudimos cargar tu sesión</Text>
            <Text size="sm" c="dimmed">
              {state.errorMessage ?? "No encontramos un workspace asociado."}
            </Text>
            <Button onClick={() => void refreshWorkspace()}>Reintentar</Button>
            <Button variant="light" color="gray" onClick={() => void signOut()}>
              Volver a ingresar
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  const canUseWorkspaceFeature = (feature: WorkspaceFeature) =>
    canUseFeature(state.workspace?.subscription ?? null, feature);

  return (
    <WorkspaceContext.Provider
      value={{
        supabase,
        user: state.user,
        workspace: state.workspace,
        workspaces: state.workspaces,
        refreshWorkspace,
        createWorkspace,
        switchWorkspace,
        canUseWorkspaceFeature,
        signOut,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }

  return context;
}
