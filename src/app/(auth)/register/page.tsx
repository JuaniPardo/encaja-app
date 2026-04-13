"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useForm } from "react-hook-form";

import { getLocalizedAuthErrorMessage } from "@/features/auth/error-messages";
import { createRegisterSchema, type RegisterValues } from "@/features/auth/schemas";
import { useI18n } from "@/features/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { bootstrapUserWorkspace } from "@/lib/workspace/bootstrap";

export default function RegisterPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const supabase = getSupabaseBrowserClient();
  const registerFormSchema = useMemo(
    () =>
      createRegisterSchema({
        invalidEmail: t("auth.validation.invalidEmail"),
        passwordMinLength: t("auth.validation.passwordMinLength"),
        fullNameMaxLength: t("auth.validation.fullNameMaxLength"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName?.trim() || null,
        },
      },
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("auth.register.createErrorTitle"),
        message: getLocalizedAuthErrorMessage(response.error, t),
      });
      return;
    }

    if (!response.data.user || !response.data.session) {
      notifications.show({
        color: "blue",
        title: t("auth.register.createdTitle"),
        message: t("auth.register.createdConfirmEmail"),
      });
      router.replace("/login");
      return;
    }

    try {
      await bootstrapUserWorkspace({
        supabase,
        user: response.data.user,
        fullNameHint: values.fullName,
        preferredLanguageHint: locale,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("auth.register.bootstrapErrorTitle"),
        message:
          error instanceof Error
            ? error.message
            : t("auth.register.bootstrapErrorFallback"),
      });
      return;
    }

    notifications.show({
      color: "green",
      title: t("auth.register.createdTitle"),
      message: t("auth.register.workspaceReady"),
    });

    router.replace("/app");
  });

  return (
    <Paper radius="lg" p="xl" withBorder shadow="sm">
      <Stack gap="md">
        <Title order={2} component="h1">{t("auth.register.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("auth.register.subtitle")}
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label={t("auth.register.fullNameLabel")}
              placeholder={t("auth.register.fullNamePlaceholder")}
              autoComplete="name"
              error={errors.fullName?.message}
              {...register("fullName")}
            />

            <TextInput
              label={t("auth.register.emailLabel")}
              placeholder={t("auth.register.emailPlaceholder")}
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <PasswordInput
              label={t("auth.register.passwordLabel")}
              placeholder={t("auth.register.passwordPlaceholder")}
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" loading={isSubmitting}>
              {t("auth.register.submit")}
            </Button>
          </Stack>
        </form>

        <Text size="sm" c="dimmed">
          {t("auth.register.hasAccount")}{" "}
          <Anchor component={Link} href="/login">
            {t("auth.register.goToLogin")}
          </Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}
