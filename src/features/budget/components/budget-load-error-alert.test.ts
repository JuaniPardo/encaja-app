import { Button, Text } from "@mantine/core";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BudgetLoadErrorAlert } from "@/features/budget/components/budget-load-error-alert";

vi.mock("@/features/i18n/provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

type ElementProps = {
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

function findByType(node: ReactNode, type: unknown): ReactElement<ElementProps> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<ElementProps>(child)) {
      continue;
    }

    if (child.type === type) {
      return child;
    }

    const nested = findByType(child.props.children, type);
    if (nested) {
      return nested;
    }
  }

  return null;
}

describe("BudgetLoadErrorAlert", () => {
  it("muestra el mensaje y un botón Reintentar que llama a onRetry", () => {
    const onRetry = vi.fn();
    const alert = BudgetLoadErrorAlert({ message: "Falló", retryDisabled: false, onRetry });

    const button = findByType(alert, Button);

    expect(findByType(alert, Text)?.props.children).toBe("Falló");
    expect(button?.props.children).toBe("common.actions.retry");
    expect(button?.props.disabled).toBe(false);

    button?.props.onClick?.();

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("deshabilita el botón mientras carga", () => {
    const alert = BudgetLoadErrorAlert({
      message: "Falló",
      retryDisabled: true,
      onRetry: vi.fn(),
    });

    expect(findByType(alert, Button)?.props.disabled).toBe(true);
  });
});
