import { Button } from "@mantine/core";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ProtectedError from "@/app/(protected)/error";

vi.mock("@/features/i18n/provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

type ButtonElement = ReactElement<{ onClick: () => void }>;

function findButton(node: ReactNode): ButtonElement | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      continue;
    }

    if (child.type === Button) {
      return child as unknown as ButtonElement;
    }

    const nested = findButton(child.props.children);
    if (nested) {
      return nested;
    }
  }

  return null;
}

describe("ProtectedError", () => {
  it("calls retry when the retry button is pressed", () => {
    const retry = vi.fn();

    const button = findButton(ProtectedError({ retry }));
    expect(button).not.toBeNull();
    expect(retry).not.toHaveBeenCalled();

    button?.props.onClick();

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
