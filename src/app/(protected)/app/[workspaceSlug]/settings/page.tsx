"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Modal,
  NativeSelect,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Controller, useForm, useWatch } from "react-hook-form";

import { type Locale } from "@/features/i18n/config";
import { useI18n } from "@/features/i18n/provider";
import {
  settingsFormSchema,
  type SettingsFormInputValues,
  type SettingsFormValues,
} from "@/features/settings/schema";
import {
  inviteWorkspaceMemberSchema,
  type InviteWorkspaceMemberInputValues,
  type InviteWorkspaceMemberValues,
} from "@/features/workspace/members-schema";
import {
  workspaceFormSchema,
  type WorkspaceFormInputValues,
  type WorkspaceFormValues,
} from "@/features/workspace/schema";
import {
  workspaceLinkFormSchema,
  type WorkspaceLinkFormInputValues,
  type WorkspaceLinkFormValues,
} from "@/features/workspace/links-schema";
import {
  canDeleteWorkspace,
  canManageWorkspaceLinks,
  canManageWorkspaceMembers,
  canManageWorkspaceSettings,
} from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, WorkspaceRole } from "@/types/database";

const savingsRateModeSelectData = [
  { value: "manual", label: "Manual" },
  { value: "percentage", label: "Porcentaje objetivo" },
];

type WorkspaceMemberSummary =
  Database["public"]["Functions"]["list_workspace_members"]["Returns"][number];
type WorkspaceLinkSummary =
  Database["public"]["Functions"]["list_workspace_links"]["Returns"][number];
type WorkspaceSettingsCurrencyRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "workspace_id" | "currency_code"
>;

function normalizeRoleLabel(role: WorkspaceRole) {
  return role === "owner" ? "owner" : "member";
}

function getMemberDisplayName(member: WorkspaceMemberSummary) {
  if (member.full_name && member.full_name.trim().length > 0) {
    return member.full_name.trim();
  }

  return member.email;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const {
    supabase,
    workspace,
    workspaces,
    refreshWorkspace,
    createWorkspace,
    deleteWorkspace,
    switchWorkspace,
    canUseWorkspaceFeature,
    locale,
    setUserLanguage,
  } = useWorkspace();
  const canEditWorkspaceSettings = canManageWorkspaceSettings(workspace.role);
  const canManageMembers = canManageWorkspaceMembers(workspace.role);
  const canManageLinks = canManageWorkspaceLinks(workspace.role);
  const canUseMultiWorkspace = canUseWorkspaceFeature("multi_workspace");
  const canCreateWorkspace = canUseMultiWorkspace && canEditWorkspaceSettings;
  const canDeleteCurrentWorkspace =
    canUseMultiWorkspace && canDeleteWorkspace(workspace.role) && workspaces.length > 1;
  const [isCreateWorkspaceOpen, { open: openCreateWorkspace, close: closeCreateWorkspace }] =
    useDisclosure(false);
  const [isDeleteWorkspaceOpen, { open: openDeleteWorkspace, close: closeDeleteWorkspace }] =
    useDisclosure(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceConfirmation, setDeleteWorkspaceConfirmation] = useState("");
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [removingMemberUserId, setRemovingMemberUserId] = useState<string | null>(null);
  const [workspaceLinks, setWorkspaceLinks] = useState<WorkspaceLinkSummary[]>([]);
  const [isWorkspaceLinksLoading, setIsWorkspaceLinksLoading] = useState(true);
  const [deactivatingLinkId, setDeactivatingLinkId] = useState<string | null>(null);
  const [workspaceCurrenciesById, setWorkspaceCurrenciesById] = useState<
    Record<string, string>
  >({});
  const [isWorkspaceCurrenciesLoading, setIsWorkspaceCurrenciesLoading] = useState(true);
  const [workspaceCurrencyCode, setWorkspaceCurrencyCode] = useState("ARS");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Locale>(locale);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);

  const languageOptions = useMemo(
    () => [
      { value: "es", label: t("settings.language.spanishOption") },
      { value: "en", label: t("settings.language.englishOption") },
    ],
    [t],
  );

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
  const {
    register: registerInviteMember,
    handleSubmit: handleSubmitInviteMember,
    reset: resetInviteMember,
    formState: {
      errors: inviteMemberErrors,
      isSubmitting: isInvitingMember,
    },
  } = useForm<InviteWorkspaceMemberInputValues, unknown, InviteWorkspaceMemberValues>({
    resolver: zodResolver(inviteWorkspaceMemberSchema),
    defaultValues: {
      email: "",
    },
  });
  const {
    control: workspaceLinkControl,
    handleSubmit: handleSubmitWorkspaceLink,
    reset: resetWorkspaceLink,
    formState: {
      errors: workspaceLinkErrors,
      isSubmitting: isWorkspaceLinkSubmitting,
    },
  } = useForm<WorkspaceLinkFormInputValues, unknown, WorkspaceLinkFormValues>({
    resolver: zodResolver(workspaceLinkFormSchema),
    defaultValues: {
      targetWorkspaceId: "",
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

  useEffect(() => {
    setSelectedLanguage(locale);
  }, [locale]);

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
      setWorkspaceCurrencyCode("ARS");
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
    setWorkspaceCurrencyCode(response.data.currency_code);
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

  const loadMembers = useCallback(async () => {
    setIsMembersLoading(true);

    const response = await supabase.rpc("list_workspace_members", {
      p_workspace_id: workspace.id,
    });

    setIsMembersLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar miembros",
        message: response.error.message,
      });
      return;
    }

    const rows = (response.data ?? []) as WorkspaceMemberSummary[];
    setMembers(rows);
  }, [supabase, workspace.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const loadWorkspaceCurrencies = useCallback(async () => {
    const workspaceIds = Array.from(new Set(workspaces.map((workspaceItem) => workspaceItem.id)));
    if (workspaceIds.length === 0) {
      setWorkspaceCurrenciesById({});
      setIsWorkspaceCurrenciesLoading(false);
      return;
    }

    setIsWorkspaceCurrenciesLoading(true);

    const response = await supabase
      .from("workspace_settings")
      .select("workspace_id, currency_code")
      .in("workspace_id", workspaceIds);

    setIsWorkspaceCurrenciesLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar monedas de workspaces",
        message: response.error.message,
      });
      return;
    }

    const rows = (response.data ?? []) as WorkspaceSettingsCurrencyRow[];
    const nextCurrenciesById: Record<string, string> = {};

    for (const row of rows) {
      nextCurrenciesById[row.workspace_id] = row.currency_code;
    }

    setWorkspaceCurrenciesById(nextCurrenciesById);
    if (nextCurrenciesById[workspace.id]) {
      setWorkspaceCurrencyCode(nextCurrenciesById[workspace.id]);
    }
  }, [supabase, workspace.id, workspaces]);

  useEffect(() => {
    void loadWorkspaceCurrencies();
  }, [loadWorkspaceCurrencies]);

  const loadWorkspaceLinks = useCallback(async () => {
    setIsWorkspaceLinksLoading(true);

    const response = await supabase.rpc("list_workspace_links", {
      p_source_workspace_id: workspace.id,
    });

    setIsWorkspaceLinksLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar vínculos",
        message: response.error.message,
      });
      return;
    }

    const rows = (response.data ?? []) as WorkspaceLinkSummary[];
    setWorkspaceLinks(rows);
  }, [supabase, workspace.id]);

  useEffect(() => {
    void loadWorkspaceLinks();
  }, [loadWorkspaceLinks]);

  useEffect(() => {
    resetInviteMember({
      email: "",
    });
  }, [resetInviteMember, workspace.id]);

  useEffect(() => {
    resetWorkspaceLink({
      targetWorkspaceId: "",
    });
  }, [resetWorkspaceLink, workspace.id]);

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

    setWorkspaceCurrencyCode(payload.currency_code);
    await loadWorkspaceCurrencies();
  });

  const onSaveLanguage = async () => {
    setIsUpdatingLanguage(true);

    try {
      await setUserLanguage(selectedLanguage);
      notifications.show({
        color: "green",
        title: t("settings.language.savedTitle"),
        message: t("settings.language.savedMessage"),
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("settings.language.errorTitle"),
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

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

  const onSubmitInviteMember = handleSubmitInviteMember(async (values) => {
    if (!canManageMembers) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede invitar miembros.",
      });
      return;
    }

    const response = await supabase.rpc("invite_workspace_member_by_email", {
      p_workspace_id: workspace.id,
      p_email: values.email,
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos invitar al miembro",
        message: response.error.message,
      });
      return;
    }

    const invitedMember = response.data?.[0];
    if (!invitedMember) {
      notifications.show({
        color: "red",
        title: "No pudimos invitar al miembro",
        message: "No recibimos confirmación del backend.",
      });
      return;
    }

    notifications.show({
      color: invitedMember.was_created ? "green" : "blue",
      title: invitedMember.was_created ? "Miembro invitado" : "Miembro ya existente",
      message: invitedMember.was_created
        ? `${invitedMember.email} ya forma parte del workspace.`
        : `${invitedMember.email} ya tenía acceso al workspace.`,
    });

    resetInviteMember({
      email: "",
    });
    await loadMembers();
  });

  const onRemoveMember = async (member: WorkspaceMemberSummary) => {
    if (!canManageMembers) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede remover miembros.",
      });
      return;
    }

    setRemovingMemberUserId(member.user_id);

    const response = await supabase.rpc("remove_workspace_member", {
      p_workspace_id: workspace.id,
      p_member_user_id: member.user_id,
    });

    setRemovingMemberUserId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos remover al miembro",
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "green",
      title: "Acceso removido",
      message: `${member.email} ya no tiene acceso a este workspace.`,
    });

    await loadMembers();
  };

  const activeLinksByTargetWorkspaceId = useMemo(
    () =>
      new Map(
        workspaceLinks
          .filter((workspaceLink) => workspaceLink.is_active)
          .map((workspaceLink) => [workspaceLink.target_workspace_id, workspaceLink]),
      ),
    [workspaceLinks],
  );

  const sourceWorkspaceCurrency = workspaceCurrencyCode.toUpperCase();

  const workspaceLinkTargetOptions = useMemo(() => {
    return workspaces
      .filter((workspaceItem) => workspaceItem.id !== workspace.id)
      .map((workspaceItem) => {
        const targetCurrency = workspaceCurrenciesById[workspaceItem.id] ?? null;
        const hasCurrencyConfigured = Boolean(targetCurrency);
        const hasCurrencyCompatibility =
          hasCurrencyConfigured && targetCurrency?.toUpperCase() === sourceWorkspaceCurrency;
        const hasActiveLink = activeLinksByTargetWorkspaceId.has(workspaceItem.id);

        let disabledReason: string | null = null;
        if (!hasCurrencyConfigured) {
          disabledReason = "sin moneda configurada";
        } else if (!hasCurrencyCompatibility) {
          disabledReason = `moneda distinta (${targetCurrency})`;
        } else if (hasActiveLink) {
          disabledReason = "ya vinculado";
        }

        const roleLabel = normalizeRoleLabel(workspaceItem.role);
        const currencyLabel = targetCurrency ?? "N/A";

        return {
          value: workspaceItem.id,
          label: `${workspaceItem.name} · ${roleLabel} · ${currencyLabel}${disabledReason ? ` (${disabledReason})` : ""}`,
          disabled: disabledReason !== null,
        };
      });
  }, [
    activeLinksByTargetWorkspaceId,
    sourceWorkspaceCurrency,
    workspace.id,
    workspaceCurrenciesById,
    workspaces,
  ]);

  const canCreateAnyWorkspaceLink = workspaceLinkTargetOptions.some((option) => !option.disabled);

  const onSubmitWorkspaceLink = handleSubmitWorkspaceLink(async (values) => {
    if (!canManageLinks) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede crear vínculos entre workspaces.",
      });
      return;
    }

    const selectedTargetWorkspace = workspaces.find(
      (workspaceItem) => workspaceItem.id === values.targetWorkspaceId,
    );
    if (!selectedTargetWorkspace) {
      notifications.show({
        color: "red",
        title: "Workspace inválido",
        message: "Seleccioná un workspace destino válido.",
      });
      return;
    }

    if (selectedTargetWorkspace.id === workspace.id) {
      notifications.show({
        color: "red",
        title: "Vínculo inválido",
        message: "No podés vincular un workspace consigo mismo.",
      });
      return;
    }

    const selectedTargetCurrency = workspaceCurrenciesById[selectedTargetWorkspace.id];
    if (!selectedTargetCurrency) {
      notifications.show({
        color: "red",
        title: "Workspace sin moneda",
        message: "El workspace destino no tiene moneda configurada.",
      });
      return;
    }

    if (selectedTargetCurrency.toUpperCase() !== sourceWorkspaceCurrency) {
      notifications.show({
        color: "red",
        title: "Moneda incompatible",
        message: `Solo podés vincular workspaces en ${sourceWorkspaceCurrency}.`,
      });
      return;
    }

    if (activeLinksByTargetWorkspaceId.has(selectedTargetWorkspace.id)) {
      notifications.show({
        color: "yellow",
        title: "Ya existe un vínculo activo",
        message: "Ese workspace ya está vinculado.",
      });
      return;
    }

    const response = await supabase.rpc("create_workspace_link", {
      p_source_workspace_id: workspace.id,
      p_target_workspace_id: selectedTargetWorkspace.id,
      p_visibility_mode: "summary_only",
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos crear el vínculo",
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "green",
      title: "Workspace vinculado",
      message: `${selectedTargetWorkspace.name} ya está disponible como resumen externo.`,
    });

    resetWorkspaceLink({
      targetWorkspaceId: "",
    });
    await loadWorkspaceLinks();
  });

  const onDeactivateWorkspaceLink = async (workspaceLink: WorkspaceLinkSummary) => {
    if (!canManageLinks) {
      notifications.show({
        color: "red",
        title: "Acción no permitida",
        message: "Solo el owner puede desactivar vínculos.",
      });
      return;
    }

    setDeactivatingLinkId(workspaceLink.link_id);

    const response = await supabase.rpc("deactivate_workspace_link", {
      p_source_workspace_id: workspace.id,
      p_link_id: workspaceLink.link_id,
    });

    setDeactivatingLinkId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos desactivar el vínculo",
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "green",
      title: "Vínculo desactivado",
      message: "El workspace dejó de mostrarse como resumen externo.",
    });

    await loadWorkspaceLinks();
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
          Estás en <b>{workspace.name}</b> con rol <b>{normalizeRoleLabel(workspace.role)}</b>.
        </Text>
      </Stack>
      {!canEditWorkspaceSettings ? (
        <Alert color="yellow" variant="light" title="Acceso de solo lectura">
          Tenés rol <b>{normalizeRoleLabel(workspace.role)}</b>. Solo el owner puede modificar la
          configuración del workspace.
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Text fw={600}>{t("settings.language.title")}</Text>
          <Text size="sm" c="dimmed">
            {t("settings.language.description")}
          </Text>
          <Group align="flex-end" wrap="wrap">
            <NativeSelect
              label={t("settings.language.fieldLabel")}
              data={languageOptions}
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.currentTarget.value as Locale)}
              style={{ minWidth: 220 }}
            />
            <Button
              type="button"
              onClick={() => void onSaveLanguage()}
              loading={isUpdatingLanguage}
              disabled={selectedLanguage === locale}
            >
              {t("settings.language.saveButton")}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600}>Miembros del workspace</Text>
            <Badge variant="light" color="gray">
              {members.length} {members.length === 1 ? "miembro" : "miembros"}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Invitá personas por email para colaborar en este workspace compartido.
          </Text>

          {!canManageMembers ? (
            <Alert color="blue" variant="light" title="Sin permisos de administración">
              Podés ver miembros, pero solo el owner puede invitar o remover acceso.
            </Alert>
          ) : null}

          <form onSubmit={onSubmitInviteMember}>
            <Group align="flex-end" wrap="wrap">
              <TextInput
                label="Invitar por email"
                placeholder="persona@ejemplo.com"
                error={inviteMemberErrors.email?.message}
                disabled={!canManageMembers}
                style={{ flex: 1, minWidth: 220 }}
                {...registerInviteMember("email")}
              />
              <Button type="submit" loading={isInvitingMember} disabled={!canManageMembers}>
                Invitar
              </Button>
            </Group>
          </form>

          {isMembersLoading ? (
            <Text size="sm" c="dimmed">
              Cargando miembros...
            </Text>
          ) : members.length === 0 ? (
            <Text size="sm" c="dimmed">
              Este workspace todavía no tiene miembros.
            </Text>
          ) : (
            <Stack gap="xs">
              {members.map((member) => {
                const canRemoveMember = canManageMembers && member.role !== "owner";

                return (
                  <Paper key={member.member_id} withBorder radius="sm" p="sm">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <Stack gap={2}>
                        <Text fw={600}>{getMemberDisplayName(member)}</Text>
                        <Text size="sm" c="dimmed">
                          {member.email}
                        </Text>
                      </Stack>
                      <Group gap="xs" align="center">
                        <Badge variant="light" color={member.role === "owner" ? "teal" : "gray"}>
                          {normalizeRoleLabel(member.role)}
                        </Badge>
                        {canRemoveMember ? (
                          <Button
                            type="button"
                            size="xs"
                            color="red"
                            variant="light"
                            loading={removingMemberUserId === member.user_id}
                            onClick={() => void onRemoveMember(member)}
                          >
                            Remover
                          </Button>
                        ) : null}
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600}>Workspaces vinculados</Text>
            <Badge variant="light" color="blue">
              {workspaceLinks.filter((workspaceLink) => workspaceLink.is_active).length} activos
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Vinculá workspaces para ver un <b>resumen externo</b> (ingresos, gastos, ahorro y
            balance) sin mezclar transacciones ni categorías con este workspace.
          </Text>
          <Text size="sm" c="dimmed">
            Moneda del workspace actual: <b>{sourceWorkspaceCurrency}</b>.
          </Text>

          {!canManageLinks ? (
            <Alert color="blue" variant="light" title="Sin permisos de administración">
              Podés ver vínculos existentes, pero solo el owner puede crear o desactivar vínculos.
            </Alert>
          ) : null}

          <form onSubmit={onSubmitWorkspaceLink}>
            <Group align="flex-end" wrap="wrap">
              <Controller
                control={workspaceLinkControl}
                name="targetWorkspaceId"
                render={({ field }) => (
                  <Select
                    label="Workspace destino"
                    placeholder={
                      canUseMultiWorkspace ? "Seleccioná workspace destino" : "Plan sin acceso"
                    }
                    data={workspaceLinkTargetOptions}
                    error={workspaceLinkErrors.targetWorkspaceId?.message}
                    disabled={
                      !canUseMultiWorkspace ||
                      !canManageLinks ||
                      isWorkspaceCurrenciesLoading ||
                      !canCreateAnyWorkspaceLink
                    }
                    style={{ flex: 1, minWidth: 260 }}
                    searchable
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <Button
                type="submit"
                loading={isWorkspaceLinkSubmitting}
                disabled={
                  !canUseMultiWorkspace ||
                  !canManageLinks ||
                  isWorkspaceCurrenciesLoading ||
                  !canCreateAnyWorkspaceLink
                }
              >
                Vincular
              </Button>
            </Group>
          </form>

          {!canUseMultiWorkspace ? (
            <Text size="sm" c="dimmed">
              Tu plan actual no incluye múltiples workspaces, por eso no podés crear vínculos.
            </Text>
          ) : null}

          {canUseMultiWorkspace &&
          canManageLinks &&
          !isWorkspaceCurrenciesLoading &&
          !canCreateAnyWorkspaceLink ? (
            <Text size="sm" c="dimmed">
              No hay workspaces compatibles para vincular. Revisá que exista otro workspace con la
              misma moneda.
            </Text>
          ) : null}

          {isWorkspaceLinksLoading ? (
            <Text size="sm" c="dimmed">
              Cargando vínculos...
            </Text>
          ) : workspaceLinks.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay workspaces vinculados.
            </Text>
          ) : (
            <Stack gap="xs">
              {workspaceLinks.map((workspaceLink) => {
                const linkName = workspaceLink.target_workspace_name ?? "Workspace sin acceso";
                const linkSlug = workspaceLink.target_workspace_slug;
                const linkCurrency = workspaceLink.target_currency_code ?? "N/A";
                const canDeactivateLink = canManageLinks && workspaceLink.is_active;

                return (
                  <Paper key={workspaceLink.link_id} withBorder radius="sm" p="sm">
                    <Stack gap={6}>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Stack gap={2}>
                          <Text fw={600}>{linkName}</Text>
                          <Text size="sm" c="dimmed">
                            {linkSlug ? `${linkSlug} · ` : ""}Moneda {linkCurrency} · Modo{" "}
                            {workspaceLink.visibility_mode}
                          </Text>
                        </Stack>
                        <Group gap="xs" align="center">
                          <Badge
                            variant="light"
                            color={workspaceLink.is_active ? "teal" : "gray"}
                          >
                            {workspaceLink.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                          {canDeactivateLink ? (
                            <Button
                              type="button"
                              size="xs"
                              color="gray"
                              variant="light"
                              loading={deactivatingLinkId === workspaceLink.link_id}
                              onClick={() => void onDeactivateWorkspaceLink(workspaceLink)}
                            >
                              Desactivar
                            </Button>
                          ) : null}
                        </Group>
                      </Group>
                      {!workspaceLink.has_target_access ? (
                        <Alert color="yellow" variant="light" title="Sin acceso al destino">
                          Este vínculo existe, pero ya no tenés permisos sobre el workspace
                          destino, así que no se mostrará su resumen.
                        </Alert>
                      ) : null}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Paper>

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
