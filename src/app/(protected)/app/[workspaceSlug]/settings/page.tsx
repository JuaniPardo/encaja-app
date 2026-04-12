"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  settingsFormSchema,
  type SettingsFormInputValues,
  type SettingsFormValues,
} from "@/features/settings/schema";
import {
  workspaceFormSchema,
  type WorkspaceFormInputValues,
  type WorkspaceFormValues,
} from "@/features/workspace/schema";
import {
  canDeleteWorkspace,
  canManageWorkspaceSettings,
} from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";

const savingsRateModeSelectData = [
  { value: "manual", label: "Manual" },
  { value: "percentage", label: "Porcentaje objetivo" },
];

export default function SettingsPage() {
  const {
    supabase,
    workspace,
    workspaces,
    refreshWorkspace,
    createWorkspace,
    deleteWorkspace,
    switchWorkspace,
    canUseWorkspaceFeature,
  } = useWorkspace();
  const canEditWorkspaceSettings = canManageWorkspaceSettings(workspace.role);
  const canUseMultiWorkspace = canUseWorkspaceFeature("multi_workspace");
  const canCreateWorkspace = canUseMultiWorkspace && canEditWorkspaceSettings;
  const canDeleteCurrentWorkspace =
    canUseMultiWorkspace && canDeleteWorkspace(workspace.role) && workspaces.length > 1;
  const [isCreateWorkspaceOpen, { open: openCreateWorkspace, close: closeCreateWorkspace }] =
    useDisclosure(false);
  const [isDeleteWorkspaceOpen, { open: openDeleteWorkspace, close: closeDeleteWorkspace }] =
    useDisclosure(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceConfirmation, setDeleteWorkspaceConfirmation] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormInputValues, unknown, SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      startYear: new Date().getFullYear(),
      savingsRateMode: "manual",
      deferredIncomeEnabled: false,
      deferredIncomeDay: null,
      showCents: false,
      currencyCode: "ARS",
    },
  });

  const deferredIncomeEnabled = useWatch({ control, name: "deferredIncomeEnabled" }) ?? false;
  const {
    register: registerWorkspace,
    handleSubmit: handleSubmitWorkspace,
    reset: resetWorkspace,
    formState: {
      errors: workspaceErrors,
      isSubmitting: isWorkspaceSubmitting,
    },
  } = useForm<WorkspaceFormInputValues, unknown, WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: workspace.name,
    },
  });
  const {
    register: registerCreateWorkspace,
    handleSubmit: handleSubmitCreateWorkspace,
    reset: resetCreateWorkspace,
    formState: {
      errors: createWorkspaceErrors,
      isSubmitting: isCreatingWorkspace,
    },
  } = useForm<WorkspaceFormInputValues, unknown, WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    resetWorkspace({
      name: workspace.name,
    });
  }, [resetWorkspace, workspace.name]);

  useEffect(() => {
    if (!isCreateWorkspaceOpen) {
      resetCreateWorkspace({
        name: "",
      });
    }
  }, [isCreateWorkspaceOpen, resetCreateWorkspace]);

  useEffect(() => {
    if (!isDeleteWorkspaceOpen) {
      setDeleteWorkspaceConfirmation("");
    }
  }, [isDeleteWorkspaceOpen]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);

    const response = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    setIsLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar settings",
        message: response.error.message,
      });
      return;
    }

    if (!response.data) {
      setSettingsId(null);
      reset({
        startYear: new Date().getFullYear(),
        savingsRateMode: "manual",
        deferredIncomeEnabled: false,
        deferredIncomeDay: null,
        showCents: false,
        currencyCode: "ARS",
      });
      return;
    }

    setSettingsId(response.data.id);
    reset({
      startYear: response.data.start_year,
      savingsRateMode: response.data.savings_rate_mode,
      deferredIncomeEnabled: response.data.deferred_income_enabled,
      deferredIncomeDay: response.data.deferred_income_day,
      showCents: response.data.show_cents ?? false,
      currencyCode: response.data.currency_code,
    });
  }, [reset, supabase, workspace.id]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const onSubmit = handleSubmit(async (values) => {
    if (!canEditWorkspaceSettings) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede modificar la configuración del workspace.",
      });
      return;
    }

    const payload = {
      start_year: values.startYear,
      savings_rate_mode: values.savingsRateMode,
      deferred_income_enabled: values.deferredIncomeEnabled,
      deferred_income_day: values.deferredIncomeEnabled ? values.deferredIncomeDay : null,
      show_cents: values.showCents,
      currency_code: values.currencyCode.toUpperCase(),
      updated_at: new Date().toISOString(),
    };

    if (settingsId) {
      const updateResponse = await supabase
        .from("workspace_settings")
        .update(payload)
        .eq("id", settingsId)
        .eq("workspace_id", workspace.id);

      if (updateResponse.error) {
        notifications.show({
          color: "red",
          title: "No pudimos actualizar settings",
          message: updateResponse.error.message,
        });
        return;
      }
    } else {
      const insertResponse = await supabase
        .from("workspace_settings")
        .insert({
          workspace_id: workspace.id,
          start_year: payload.start_year,
          savings_rate_mode: payload.savings_rate_mode,
          deferred_income_enabled: payload.deferred_income_enabled,
          deferred_income_day: payload.deferred_income_day,
          show_cents: payload.show_cents,
          currency_code: payload.currency_code,
        })
        .select("id")
        .single();

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: "No pudimos crear settings",
          message: insertResponse.error.message,
        });
        return;
      }

      setSettingsId(insertResponse.data.id);
    }

    notifications.show({
      color: "green",
      title: "Settings guardados",
      message: "La configuración del workspace se actualizó correctamente.",
    });
  });

  const onSubmitWorkspace = handleSubmitWorkspace(async (values) => {
    if (!canEditWorkspaceSettings) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede editar la identidad del workspace.",
      });
      return;
    }

    const response = await supabase
      .from("workspaces")
      .update({
        name: values.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workspace.id);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos actualizar el workspace",
        message: response.error.message,
      });
      return;
    }

    await refreshWorkspace();

    notifications.show({
      color: "green",
      title: "Workspace actualizado",
      message: "La identidad del workspace se actualizó correctamente.",
    });
  });

  const onSubmitCreateWorkspace = handleSubmitCreateWorkspace(async (values) => {
    if (!canCreateWorkspace) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede crear workspaces.",
      });
      return;
    }

    try {
      const createdWorkspace = await createWorkspace(values.name);
      notifications.show({
        color: "green",
        title: "Workspace creado",
        message: `${createdWorkspace.name} ya está disponible.`,
      });
      closeCreateWorkspace();
      switchWorkspace(createdWorkspace.slug, "/settings");
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No pudimos crear el workspace",
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado al crear el workspace.",
      });
    }
  });

  const onDeleteWorkspace = async () => {
    if (!canDeleteCurrentWorkspace) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Necesitás ser owner y tener al menos otro workspace disponible.",
      });
      return;
    }

    if (deleteWorkspaceConfirmation.trim() !== workspace.name.trim()) {
      notifications.show({
        color: "red",
        title: "Confirmación inválida",
        message: "Escribí el nombre exacto del workspace para confirmar la eliminación.",
      });
      return;
    }

    setIsDeletingWorkspace(true);

    try {
      const fallbackWorkspace = await deleteWorkspace(workspace.id);
      closeDeleteWorkspace();
      notifications.show({
        color: "green",
        title: "Workspace eliminado",
        message: `Te movimos a ${fallbackWorkspace.name}.`,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No pudimos eliminar el workspace",
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado al eliminar el workspace.",
      });
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Modal
        opened={isCreateWorkspaceOpen}
        onClose={closeCreateWorkspace}
        title="Crear workspace"
        centered
      >
        <form onSubmit={onSubmitCreateWorkspace}>
          <Stack gap="sm">
            <TextInput
              label="Nombre visible"
              placeholder="Ej: Hogar, Consultorio, Negocio"
              error={createWorkspaceErrors.name?.message}
              {...registerCreateWorkspace("name")}
            />
            <Group justify="flex-end">
              <Button type="button" variant="light" color="gray" onClick={closeCreateWorkspace}>
                Cancelar
              </Button>
              <Button type="submit" loading={isCreatingWorkspace}>
                Crear
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={isDeleteWorkspaceOpen}
        onClose={closeDeleteWorkspace}
        title="Eliminar workspace"
        centered
      >
        <Stack gap="sm">
          <Alert color="red" variant="light" title="Acción irreversible">
            Se eliminarán categorías, transacciones, presupuestos y settings del workspace.
          </Alert>
          <Text size="sm">
            Escribí <b>{workspace.name}</b> para confirmar.
          </Text>
          <TextInput
            value={deleteWorkspaceConfirmation}
            onChange={(event) => setDeleteWorkspaceConfirmation(event.currentTarget.value)}
            placeholder={workspace.name}
          />
          <Group justify="flex-end">
            <Button
              type="button"
              variant="light"
              color="gray"
              onClick={closeDeleteWorkspace}
              disabled={isDeletingWorkspace}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              color="red"
              loading={isDeletingWorkspace}
              disabled={deleteWorkspaceConfirmation.trim() !== workspace.name.trim()}
              onClick={() => void onDeleteWorkspace()}
            >
              Eliminar workspace
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack gap={2}>
        <Title order={2}>Settings del workspace</Title>
        <Text c="dimmed" size="sm">
          Configurá parámetros base que se usarán en los siguientes MVPs.
        </Text>
      </Stack>
      {!canEditWorkspaceSettings ? (
        <Alert color="yellow" variant="light" title="Acceso de solo lectura">
          Tenés rol <b>{workspace.role}</b>. Solo el owner puede modificar la configuración del workspace.
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p="md">
        <form onSubmit={onSubmitWorkspace}>
          <Stack>
            <Group justify="space-between" align="center">
              <Text fw={600}>Identidad del workspace</Text>
              {canCreateWorkspace ? (
                <Button variant="subtle" size="xs" onClick={openCreateWorkspace}>
                  Crear workspace
                </Button>
              ) : null}
            </Group>
            <TextInput
              label="Nombre visible"
              placeholder="Ej: Hogar"
              disabled={!canEditWorkspaceSettings}
              error={workspaceErrors.name?.message}
              {...registerWorkspace("name")}
            />
            <Group justify="flex-end" mt="sm">
              <Button
                type="submit"
                loading={isWorkspaceSubmitting}
                disabled={!canEditWorkspaceSettings}
              >
                Guardar nombre
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Año de inicio"
              type="number"
              placeholder="2026"
              error={errors.startYear?.message}
              {...register("startYear")}
            />

            <NativeSelect
              label="Modo de ahorro"
              data={savingsRateModeSelectData}
              disabled={!canEditWorkspaceSettings}
              error={errors.savingsRateMode?.message}
              {...register("savingsRateMode")}
            />

            <Controller
              control={control}
              name="deferredIncomeEnabled"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  disabled={!canEditWorkspaceSettings}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                  label="Habilitar ingreso diferido"
                />
              )}
            />

            <TextInput
              label="Día de diferimiento"
              type="number"
              placeholder="Ej: 5"
              disabled={!deferredIncomeEnabled}
              readOnly={!canEditWorkspaceSettings}
              error={errors.deferredIncomeDay?.message}
              {...register("deferredIncomeDay")}
            />

            <TextInput
              label="Moneda"
              placeholder="ARS"
              maxLength={3}
              readOnly={!canEditWorkspaceSettings}
              error={errors.currencyCode?.message}
              {...register("currencyCode")}
            />

            <Controller
              control={control}
              name="showCents"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  disabled={!canEditWorkspaceSettings}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                  label="Mostrar centavos en la UI"
                />
              )}
            />

            <Group justify="flex-end" mt="sm">
              <Button type="button" variant="light" color="gray" onClick={() => void loadSettings()}>
                Revertir
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={!canEditWorkspaceSettings}>
                Guardar settings
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Text fw={600} c="red.7">
            Zona de peligro
          </Text>
          <Text size="sm" c="dimmed">
            Podés eliminar este workspace si tenés otro disponible. Esta acción es irreversible.
          </Text>
          {!canDeleteWorkspace(workspace.role) ? (
            <Text size="sm" c="dimmed">
              Solo el owner puede eliminar workspaces.
            </Text>
          ) : null}
          {workspaces.length <= 1 ? (
            <Text size="sm" c="dimmed">
              Necesitás al menos otro workspace antes de eliminar este.
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button
              color="red"
              variant="light"
              onClick={openDeleteWorkspace}
              disabled={!canDeleteCurrentWorkspace}
            >
              Eliminar workspace
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
