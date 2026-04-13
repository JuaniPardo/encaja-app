"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

import { createLoginSchema, type LoginValues } from "@/features/auth/schemas";
import { getLocalizedAuthErrorMessage } from "@/features/auth/error-messages";
import { useI18n } from "@/features/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

function getSafeNextPath(pathname: string | null) {
  if (!pathname || !pathname.startsWith("/app")) {
    return "/app";
  }

  return pathname;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const supabase = getSupabaseBrowserClient();
  const loginFormSchema = useMemo(
    () =>
      createLoginSchema({
        invalidEmail: t("auth.validation.invalidEmail"),
        passwordMinLength: t("auth.validation.passwordMinLength"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("auth.login.errorTitle"),
        message: getLocalizedAuthErrorMessage(response.error, t),
      });
      return;
    }

    notifications.show({
      color: "green",
      title: t("auth.login.successTitle"),
      message: t("auth.login.successMessage"),
    });

    const nextPath = getSafeNextPath(searchParams.get("next"));
    router.replace(nextPath);
  });

  return (
    <Paper radius="lg" p="xl" withBorder shadow="sm">
      <Stack gap="md">
        <Title order={2}>{t("auth.login.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("auth.login.subtitle")}
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label={t("auth.login.emailLabel")}
              placeholder={t("auth.login.emailPlaceholder")}
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <PasswordInput
              label={t("auth.login.passwordLabel")}
              placeholder={t("auth.login.passwordPlaceholder")}
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" loading={isSubmitting}>
              {t("auth.login.submit")}
            </Button>
          </Stack>
        </form>

        <Text size="sm" c="dimmed">
          {t("auth.login.noAccount")}{" "}
          <Anchor component={Link} href="/register">
            {t("auth.login.goToRegister")}
          </Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}

function LoginPageFallback() {
  const { t } = useI18n();

  return (
    <Paper radius="lg" p="xl" withBorder shadow="sm">
      <Stack gap="md">
        <Title order={2}>{t("auth.login.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("auth.login.fallback")}
        </Text>
      </Stack>
    </Paper>
  );
}
