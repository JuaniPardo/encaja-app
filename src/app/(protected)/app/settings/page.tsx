"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import { Controller, useForm } from "react-hook-form";

import {
  settingsFormSchema,
  type SettingsFormValues,
} from "@/features/settings/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";

const savingsRateModeSelectData = [
  { value: "manual", label: "Manual" },
  { value: "percentage", label: "Porcentaje objetivo" },
];

export default function SettingsPage() {
  const { supabase, workspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      startYear: new Date().getFullYear(),
      savingsRateMode: "manual",
      deferredIncomeEnabled: false,
      deferredIncomeDay: null,
      currencyCode: "ARS",
    },
  });

  const deferredIncomeEnabled = watch("deferredIncomeEnabled");

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
      currencyCode: response.data.currency_code,
    });
  }, [reset, supabase, workspace.id]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      start_year: values.startYear,
      savings_rate_mode: values.savingsRateMode,
      deferred_income_enabled: values.deferredIncomeEnabled,
      deferred_income_day: values.deferredIncomeEnabled ? values.deferredIncomeDay : null,
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

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Stack gap={2}>
        <Title order={2}>Settings del workspace</Title>
        <Text c="dimmed" size="sm">
          Configurá parámetros base que se usarán en los siguientes MVPs.
        </Text>
      </Stack>

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
              error={errors.savingsRateMode?.message}
              {...register("savingsRateMode")}
            />

            <Controller
              control={control}
              name="deferredIncomeEnabled"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
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
              error={errors.deferredIncomeDay?.message}
              {...register("deferredIncomeDay")}
            />

            <TextInput
              label="Moneda"
              placeholder="ARS"
              maxLength={3}
              error={errors.currencyCode?.message}
              {...register("currencyCode")}
            />

            <Group justify="flex-end" mt="sm">
              <Button type="button" variant="light" color="gray" onClick={() => void loadSettings()}>
                Revertir
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Guardar settings
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
