import { describe, expect, it } from "vitest";

import { supportedLocales } from "@/features/i18n/config";
import { getTranslation } from "@/features/i18n/dictionaries";
import type { TranslationFn } from "@/features/insights/intl";
import { insightKindBadgeKey, resolveInsightKindLabel } from "@/features/insights/kind-label";
import type { InsightKind } from "@/features/insights/types";

const kinds = Object.keys(insightKindBadgeKey) as InsightKind[];

describe("resolveInsightKindLabel", () => {
  it("covers every insight kind", () => {
    expect([...kinds].sort()).toEqual(
      [
        "budget_at_risk",
        "budget_exceeded",
        "budget_pace_below",
        "category_imbalance",
        "excess_spending",
        "full_payment",
        "high_debt",
        "high_usage",
        "low_activity",
        "low_saving",
        "next_month_commitment",
        "rolled_debt",
        "spending_acceleration",
        "stable",
        "unpaid",
      ].sort(),
    );
  });

  it.each(supportedLocales.flatMap((locale) => kinds.map((kind) => ({ locale, kind }))))(
    "translates the $kind badge in $locale",
    ({ locale, kind }) => {
      const t: TranslationFn = (key, fallback, values) => getTranslation(locale, key, fallback, values);
      const label = resolveInsightKindLabel({ kind }, t);

      expect(label).not.toBe(insightKindBadgeKey[kind]);
      expect(label.startsWith("insightsV2.")).toBe(false);
      expect(["Atención", "Attention"]).not.toContain(label);
    },
  );

  it("labels card acceleration as rising use, not attention", () => {
    const t: TranslationFn = (key, fallback, values) => getTranslation("es", key, fallback, values);

    expect(resolveInsightKindLabel({ kind: "spending_acceleration" }, t)).toBe("Uso en aumento");
  });
});
