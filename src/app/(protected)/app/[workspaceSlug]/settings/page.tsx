"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
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
import { canManageWorkspaceSettings } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";

const savingsRateModeSelectData = [
  { value: "manual", label: "Manual" },
  { value: "percentage", label: "Porcentaje objetivo" },
];

export default function SettingsPage() {
  const { supabase, workspace, refreshWorkspace } = useWorkspace();
  const canEditWorkspaceSettings = canManageWorkspaceSettings(workspace.role);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    resetWorkspace({
      name: workspace.name,
    });
  }, [resetWorkspace, workspace.name]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} />

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
            <Text fw={600}>Identidad del workspace</Text>
            <TextInput
              label="Nombre visible"
              placeholder="Ej: Hogar"
              disabled={!canEditWorkspaceSettings}
              error={workspaceErrors.name?.message}
              {...registerWorkspace("name")}
            />
            <TextInput label="Slug técnico" value={workspace.slug} readOnly />
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
    </Stack>
  );
}
