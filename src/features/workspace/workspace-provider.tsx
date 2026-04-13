"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Button, Center, Loader, Paper, Stack, Text } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";

import { canUseFeature, type WorkspaceFeature } from "@/features/billing/feature-access";
import { normalizeLocale, type Locale } from "@/features/i18n/config";
import { useI18n } from "@/features/i18n/provider";
import {
  buildFallbackWorkspacePath,
  pickActiveWorkspace,
} from "@/features/workspace/context-routing";
import {
  buildWorkspaceHref,
  getWorkspaceSlugFromPathname,
} from "@/features/workspace/routing";
import { LAST_WORKSPACE_SLUG_STORAGE_KEY } from "@/features/workspace/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  bootstrapUserWorkspace,
  createWorkspaceForUser,
  deleteWorkspaceForUser,
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
  deleteWorkspace: (workspaceId: string) => Promise<WorkspaceSummary>;
  switchWorkspace: (workspaceSlug: string, sectionPath?: string) => void;
  canUseWorkspaceFeature: (feature: WorkspaceFeature) => boolean;
  locale: Locale;
  setUserLanguage: (language: Locale) => Promise<void>;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceState {
  isInitializing: boolean;
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

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeWorkspaceSlug = getWorkspaceSlugFromPathname(pathname ?? "");
  const { locale, setLocale, t } = useI18n();

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const requestCounterRef = useRef(0);
  const pathnameRef = useRef(pathname ?? "/app");
  const [state, setState] = useState<WorkspaceState>({
    isInitializing: true,
    errorMessage: null,
    user: null,
    workspaces: [],
    workspace: null,
  });

  useEffect(() => {
    pathnameRef.current = pathname ?? "/app";
  }, [pathname]);

  const loadSessionAndWorkspaces = useCallback(
    async (options?: { forceBootstrap?: boolean }) => {
      const requestId = requestCounterRef.current + 1;
      requestCounterRef.current = requestId;

      const userResponse = await supabase.auth.getUser();
      if (userResponse.error || !userResponse.data.user) {
        await supabase.auth.signOut();
        if (requestCounterRef.current !== requestId) {
          return;
        }

        setState({
          isInitializing: false,
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
        if (options?.forceBootstrap ?? true) {
          await bootstrapUserWorkspace({
            supabase,
            user,
            fullNameHint: fullNameFromMetadata,
            preferredLanguageHint: locale,
          });
        }

        const profileResponse = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("id", user.id)
          .maybeSingle();

        if (!profileResponse.error) {
          const preferredLanguage = normalizeLocale(profileResponse.data?.preferred_language ?? null);
          if (preferredLanguage && preferredLanguage !== locale) {
            setLocale(preferredLanguage);
          }
        }

        const workspaces = await listUserWorkspaces({ supabase, user });
        const workspace = pickActiveWorkspace(
          workspaces,
          {
            routeWorkspaceSlug: getWorkspaceSlugFromPathname(pathnameRef.current),
            currentWorkspaceSlug: null,
            rememberedWorkspaceSlug: readLastWorkspaceSlug(),
          },
        );

        if (!workspace) {
          throw new Error(t("workspace.noWorkspaceAssociated"));
        }

        if (requestCounterRef.current !== requestId) {
          return;
        }

        setState({
          isInitializing: false,
          errorMessage: null,
          user,
          workspaces,
          workspace,
        });

        rememberLastWorkspaceSlug(workspace.slug);
      } catch (error) {
        if (requestCounterRef.current !== requestId) {
          return;
        }

        setState({
          isInitializing: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : t("workspace.initializingError"),
          user,
          workspaces: [],
          workspace: null,
        });
      }
    },
    [locale, router, setLocale, supabase, t],
  );

  const refreshWorkspace = useCallback(async () => {
    if (!state.user) {
      await loadSessionAndWorkspaces();
      return;
    }

    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;

    try {
      const workspaces = await listUserWorkspaces({ supabase, user: state.user });
      const workspace = pickActiveWorkspace(
        workspaces,
        {
          routeWorkspaceSlug: getWorkspaceSlugFromPathname(pathnameRef.current),
          currentWorkspaceSlug: state.workspace?.slug ?? null,
          rememberedWorkspaceSlug: readLastWorkspaceSlug(),
        },
      );

      if (!workspace) {
        throw new Error(t("workspace.noWorkspaceAssociated"));
      }

      if (requestCounterRef.current !== requestId) {
        return;
      }

      setState((prev) => ({
        ...prev,
        errorMessage: null,
        workspaces,
        workspace,
      }));

      rememberLastWorkspaceSlug(workspace.slug);
    } catch (error) {
      if (requestCounterRef.current !== requestId) {
        return;
      }

      setState((prev) => ({
        ...prev,
        errorMessage:
          error instanceof Error ? error.message : t("workspace.refreshError"),
      }));
    }
  }, [loadSessionAndWorkspaces, state.user, state.workspace?.slug, supabase, t]);

  const createWorkspace = useCallback(
    async (name: string) => {
      if (!state.user) {
        throw new Error(t("workspace.noSessionAvailable"));
      }

      const createdWorkspace = await createWorkspaceForUser({
        supabase,
        user: state.user,
        name,
        preferredLanguageHint: locale,
      });

      const workspaces = await listUserWorkspaces({
        supabase,
        user: state.user,
      });

      setState((prev) => ({
        ...prev,
        workspaces,
        workspace: createdWorkspace,
        errorMessage: null,
      }));

      rememberLastWorkspaceSlug(createdWorkspace.slug);
      return createdWorkspace;
    },
    [locale, state.user, supabase, t],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!state.user) {
        throw new Error(t("workspace.noSessionAvailable"));
      }

      const workspaceToDelete = state.workspaces.find(
        (workspaceItem) => workspaceItem.id === workspaceId,
      );
      if (!workspaceToDelete) {
        throw new Error("No encontramos el workspace que querés eliminar.");
      }

      await deleteWorkspaceForUser({
        supabase,
        workspaceId,
      });

      const workspaces = await listUserWorkspaces({
        supabase,
        user: state.user,
      });

      const routeWorkspaceSlug = getWorkspaceSlugFromPathname(pathnameRef.current);
      const rememberedWorkspaceSlug = readLastWorkspaceSlug();
      const workspace = pickActiveWorkspace(workspaces, {
        routeWorkspaceSlug:
          routeWorkspaceSlug === workspaceToDelete.slug ? null : routeWorkspaceSlug,
        currentWorkspaceSlug:
          state.workspace?.id === workspaceId ? null : (state.workspace?.slug ?? null),
        rememberedWorkspaceSlug:
          rememberedWorkspaceSlug === workspaceToDelete.slug ? null : rememberedWorkspaceSlug,
      });

      if (!workspace) {
        throw new Error(t("workspace.needActiveWorkspace"));
      }

      setState((prev) => ({
        ...prev,
        workspaces,
        workspace,
        errorMessage: null,
      }));

      rememberLastWorkspaceSlug(workspace.slug);
      return workspace;
    },
    [state.user, state.workspace?.id, state.workspace?.slug, state.workspaces, supabase, t],
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
      isInitializing: false,
      errorMessage: null,
      user: null,
      workspaces: [],
      workspace: null,
    });
    router.replace("/login");
  }, [router, supabase]);

  const setUserLanguage = useCallback(
    async (language: Locale) => {
      if (!state.user) {
        throw new Error(t("workspace.noSessionAvailable"));
      }

      const normalizedLanguage = normalizeLocale(language) ?? locale;
      const response = await supabase
        .from("profiles")
        .update({
          preferred_language: normalizedLanguage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.user.id);

      if (response.error) {
        throw response.error;
      }

      setLocale(normalizedLanguage);
    },
    [locale, setLocale, state.user, supabase, t],
  );

  useEffect(() => {
    void loadSessionAndWorkspaces();

    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({
          isInitializing: false,
          errorMessage: null,
          user: null,
          workspaces: [],
          workspace: null,
        });
        router.replace("/login");
        return;
      }

      void loadSessionAndWorkspaces({ forceBootstrap: false });
    });

    return () => {
      authListener.data.subscription.unsubscribe();
    };
  }, [loadSessionAndWorkspaces, router, supabase.auth]);

  useEffect(() => {
    if (state.isInitializing || !state.user || state.workspaces.length === 0) {
      return;
    }

    const currentWorkspaceSlug = state.workspace?.slug ?? null;
    const activeWorkspace = pickActiveWorkspace(
      state.workspaces,
      {
        routeWorkspaceSlug,
        currentWorkspaceSlug,
        rememberedWorkspaceSlug: readLastWorkspaceSlug(),
      },
    );

    if (!activeWorkspace) {
      return;
    }

    if (currentWorkspaceSlug !== activeWorkspace.slug) {
      setState((prev) => ({ ...prev, workspace: activeWorkspace }));
    }

    rememberLastWorkspaceSlug(activeWorkspace.slug);

    if (routeWorkspaceSlug !== activeWorkspace.slug) {
      const fallbackPath = buildFallbackWorkspacePath(pathname ?? "/app", activeWorkspace.slug);
      if (fallbackPath !== pathname) {
        router.replace(fallbackPath);
      }
    }
  }, [
    pathname,
    routeWorkspaceSlug,
    router,
    state.isInitializing,
    state.user,
    state.workspace?.slug,
    state.workspaces,
  ]);

  if (state.isInitializing) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            {t("workspace.loading")}
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
            <Text fw={600}>{t("workspace.sessionErrorTitle")}</Text>
            <Text size="sm" c="dimmed">
              {state.errorMessage ?? t("workspace.sessionErrorFallback")}
            </Text>
            <Button onClick={() => void loadSessionAndWorkspaces()}>
              {t("common.actions.retry")}
            </Button>
            <Button variant="light" color="gray" onClick={() => void signOut()}>
              {t("workspace.backToLogin")}
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
        deleteWorkspace,
        switchWorkspace,
        canUseWorkspaceFeature,
        locale,
        setUserLanguage,
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
