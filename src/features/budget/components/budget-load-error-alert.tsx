import { Alert, Button, Group, Text } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";

type BudgetLoadErrorAlertProps = {
  message: string;
  retryDisabled: boolean;
  onRetry: () => void;
};

export function BudgetLoadErrorAlert({
  message,
  retryDisabled,
  onRetry,
}: BudgetLoadErrorAlertProps) {
  const { t } = useI18n();

  return (
    <Alert color="red" variant="light">
      <Group justify="space-between" gap="xs">
        <Text size="sm">{message}</Text>
        <Button size="xs" variant="light" color="red" disabled={retryDisabled} onClick={onRetry}>
          {t("common.actions.retry")}
        </Button>
      </Group>
    </Alert>
  );
}
