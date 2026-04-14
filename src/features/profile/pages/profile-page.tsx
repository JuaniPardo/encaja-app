"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Center,
  Container,
  Group,
  Loader,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { normalizeLocale, type Locale } from "@/features/i18n/config";
import { useI18n } from "@/features/i18n/provider";
import {
  createProfileFormSchema,
  type ProfileFormInputValues,
  type ProfileFormValues,
} from "@/features/profile/schema";
import { ROUTES } from "@/lib/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface SessionUser {
  id: string;
  email: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSendingResetPassword, setIsSendingResetPassword] = useState(false);

  const profileFormSchema = useMemo(
    () =>
      createProfileFormSchema({
        requiredName: t("common.validation.requiredName"),
        maxNameLength: t("auth.validation.fullNameMaxLength"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormInputValues, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      language: locale,
    },
  });

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);

    const userResponse = await supabase.auth.getUser();
    if (userResponse.error || !userResponse.data.user) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    const user = userResponse.data.user;
    if (!user.email) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    setSessionUser({
      id: user.id,
      email: user.email,
    });

    const profileResponse = await supabase
      .from("profiles")
      .select("full_name, preferred_language")
      .eq("id", user.id)
      .maybeSingle();

    if (profileResponse.error) {
      notifications.show({
        color: "red",
        title: t("profile.notifications.loadErrorTitle"),
        message: profileResponse.error.message,
      });
      setIsLoadingProfile(false);
      return;
    }

    const preferredLanguage =
      normalizeLocale(profileResponse.data?.preferred_language ?? null) ?? locale;

    reset({
      fullName: profileResponse.data?.full_name?.trim() ?? "",
      language: preferredLanguage,
    });

    setIsLoadingProfile(false);
  }, [locale, reset, router, supabase, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadProfile]);

  const onSubmit = handleSubmit(async (values) => {
    if (!sessionUser) {
      return;
    }

    setIsSavingProfile(true);

    const response = await supabase
      .from("profiles")
      .update({
        full_name: values.fullName.trim(),
        preferred_language: values.language,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionUser.id);

    setIsSavingProfile(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("profile.notifications.saveErrorTitle"),
        message: response.error.message,
      });
      return;
    }

    setLocale(values.language as Locale);
    reset(values);

    notifications.show({
      color: "cyan",
      title: t("profile.notifications.savedTitle"),
      message: t("profile.notifications.savedMessage"),
    });
  });

  const onResetPassword = async () => {
    if (!sessionUser?.email) {
      return;
    }

    setIsSendingResetPassword(true);

    const response = await supabase.auth.resetPasswordForEmail(sessionUser.email);

    setIsSendingResetPassword(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("profile.notifications.passwordResetErrorTitle"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "blue",
      title: t("profile.notifications.passwordResetSentTitle"),
      message: t("profile.notifications.passwordResetSentMessage"),
    });
  };

  if (isLoadingProfile) {
    return (
      <Center h="70vh">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            {t("common.messages.loading")}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="sm" py="md">
      <Stack gap="md">
        <Title order={2} component="h1">
          {t("profile.title")}
        </Title>

        <Paper withBorder radius="md" p="md">
          <form onSubmit={onSubmit}>
            <Stack gap="sm">
              <Text fw={600}>{t("profile.form.title")}</Text>
              <TextInput
                label={t("profile.form.emailLabel")}
                value={sessionUser?.email ?? ""}
                readOnly
                disabled
              />
              <TextInput
                label={t("profile.form.fullNameLabel")}
                placeholder={t("profile.form.fullNamePlaceholder")}
                error={errors.fullName?.message}
                {...register("fullName")}
              />
              <NativeSelect
                label={t("settings.language.fieldLabel")}
                data={[
                  { value: "es", label: t("settings.language.spanishOption") },
                  { value: "en", label: t("settings.language.englishOption") },
                ]}
                error={errors.language?.message}
                {...register("language")}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={isSavingProfile} disabled={!isDirty}>
                  {t("profile.form.saveButton")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        <Paper withBorder radius="md" p="sm">
          <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
            <Stack gap={2}>
              <Text fw={600}>{t("profile.security.title")}</Text>
              <Text size="sm" c="dimmed">
                {t("profile.security.description")}
              </Text>
            </Stack>
            <Group justify="flex-end">
              <Button
                type="button"
                size="sm"
                variant="light"
                onClick={() => void onResetPassword()}
                loading={isSendingResetPassword}
              >
                {t("profile.security.resetPasswordButton")}
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
