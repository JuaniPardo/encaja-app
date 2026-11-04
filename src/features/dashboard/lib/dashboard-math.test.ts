import { describe, expect, it } from "vitest";

import { buildSafeCurrencyFormatter, getDeviationColor } from "./dashboard-math";

const fallbackFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function normalizeSpaces(value: string) {
  return value.replace(/[  ]/g, " ");
}

describe("buildSafeCurrencyFormatter", () => {
  it("formats BOB amounts with the Bs symbol", () => {
    const withCents = buildSafeCurrencyFormatter("es-AR", "BOB", true, fallbackFormatter);
    const withoutCents = buildSafeCurrencyFormatter("en-US", "BOB", false, fallbackFormatter);

    expect(normalizeSpaces(withCents.format(1234.5))).toBe("Bs 1.234,50");
    expect(normalizeSpaces(withoutCents.format(1234.5))).toBe("Bs 1,235");
  });

  it("keeps the fallback formatter for invalid currency codes", () => {
    expect(buildSafeCurrencyFormatter("es-AR", "N/A", true, fallbackFormatter)).toBe(
      fallbackFormatter,
    );
  });
});

describe("getDeviationColor", () => {
  it("treats saving above budget as positive and below budget as negative", () => {
    expect(getDeviationColor("saving", 100)).toBe("var(--encaja-positive-text)");
    expect(getDeviationColor("saving", -100)).toBe("var(--encaja-negative-text)");
    expect(getDeviationColor("saving", 0.001)).toBe("var(--encaja-text-neutral)");
  });

  it("keeps the income and expense criteria", () => {
    expect(getDeviationColor("income", 100)).toBe("var(--encaja-positive-text)");
    expect(getDeviationColor("income", -100)).toBe("var(--encaja-negative-text)");
    expect(getDeviationColor("expense", 100)).toBe("var(--encaja-negative-text)");
    expect(getDeviationColor("expense", -100)).toBe("var(--encaja-positive-text)");
    expect(getDeviationColor("expense", -0.004)).toBe("var(--encaja-text-neutral)");
  });
});
