"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, NativeSelect, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";

import {
  createFeedbackFormSchema,
  type FeedbackFormInputValues,
  type FeedbackFormValues,
} from "@/features/feedback/schema";
import { useI18n } from "@/features/i18n/provider";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { createFeedback } from "@/lib/feedback/create-feedback";

interface FeedbackFormProps {
  hideHeading?: boolean;
  onSubmitted?: () => void;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

export function FeedbackForm({ hideHeading = false, onSubmitted }: FeedbackFormProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { supabase, workspace } = useWorkspace();
  const feedbackSchema = useMemo(
    () =>
      createFeedbackFormSchema({
        requiredType: t("common.forms.feedback.requiredType"),
        invalidType: t("common.forms.feedback.invalidType"),
        requiredMessage: t("common.forms.feedback.requiredMessage"),
        maxMessageLength: t("common.forms.feedback.maxMessageLength"),
      }),
    [t],
  );
  const feedbackTypeOptions = useMemo(
    () => [
      { value: "", label: t("settings.feedback.typePlaceholder") },
      { value: "bug", label: t("settings.feedback.typeOptions.bug") },
      { value: "suggestion", label: t("settings.feedback.typeOptions.suggestion") },
      { value: "question", label: t("settings.feedback.typeOptions.question") },
      { value: "other", label: t("settings.feedback.typeOptions.other") },
    ],
    [t],
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackFormInputValues, unknown, FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: "",
      message: "",
    },
  });

  const onSubmitFeedback = handleSubmit(async (values) => {
    try {
      await createFeedback({
        supabase,
        workspaceId: workspace.id,
        type: values.type,
        message: values.message,
        route: pathname ?? null,
      });

      notifications.show({
        color: "cyan",
        title: t("settings.feedback.successTitle"),
        message: t("settings.feedback.successMessage"),
      });

      reset({
        type: "",
        message: "",
      });
      onSubmitted?.();
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("settings.feedback.errorTitle"),
        message: getErrorMessage(error, t("settings.feedback.errorFallbackMessage")),
      });
    }
  });

  return (
    <form onSubmit={onSubmitFeedback}>
      <Stack gap="sm">
        {!hideHeading ? (
          <>
            <Text fw={600}>{t("settings.feedback.title")}</Text>
            <Text size="sm" c="dimmed">
              {t("settings.feedback.description")}
            </Text>
          </>
        ) : null}
        <NativeSelect
          label={t("settings.feedback.typeLabel")}
          data={feedbackTypeOptions}
          error={errors.type?.message}
          {...register("type")}
        />
        <Textarea
          label={t("settings.feedback.messageLabel")}
          placeholder={t("settings.feedback.messagePlaceholder")}
          autosize
          minRows={4}
          maxRows={7}
          maxLength={1500}
          error={errors.message?.message}
          {...register("message")}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting}>
            {t("settings.feedback.sendButton")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
