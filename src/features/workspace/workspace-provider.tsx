"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Button, Center, Loader, Paper, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  bootstrapUserWorkspace,
  type WorkspaceSummary,
} from "@/lib/workspace/bootstrap";
import type { Database } from "@/types/database";

interface WorkspaceContextValue {
  supabase: SupabaseClient<Database>;
  user: User;
  workspace: WorkspaceSummary;
  refreshWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceState {
  isLoading: boolean;
  errorMessage: string | null;
  user: User | null;
  workspace: WorkspaceSummary | null;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<WorkspaceState>({
    isLoading: true,
    errorMessage: null,
    user: null,
    workspace: null,
  });

  const refreshWorkspace = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, errorMessage: null }));

    const userResponse = await supabase.auth.getUser();
    if (userResponse.error || !userResponse.data.user) {
      await supabase.auth.signOut();
      setState({
        isLoading: false,
        errorMessage: null,
        user: null,
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
      const workspace = await bootstrapUserWorkspace({
        supabase,
        user,
        fullNameHint: fullNameFromMetadata,
      });

      setState({
        isLoading: false,
        errorMessage: null,
        user,
        workspace,
      });
    } catch (error) {
      setState({
        isLoading: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "No pudimos inicializar el workspace.",
        user,
        workspace: null,
      });
    }
  }, [router, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      isLoading: false,
      errorMessage: null,
      user: null,
      workspace: null,
    });
    router.replace("/login");
  }, [router, supabase]);

  useEffect(() => {
    void refreshWorkspace();

    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({
          isLoading: false,
          errorMessage: null,
          user: null,
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
  }, [refreshWorkspace, router, supabase.auth]);

  if (state.isLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Preparando tu workspace...
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

  return (
    <WorkspaceContext.Provider
      value={{
        supabase,
        user: state.user,
        workspace: state.workspace,
        refreshWorkspace,
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
