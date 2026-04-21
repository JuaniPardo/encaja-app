"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSafeCurrencyFormatter } from "@/features/dashboard/lib/dashboard-math";
import { buildInsightsResult } from "@/features/insights/engine";
import { loadInsightsContext } from "@/features/insights/data";
import type { TranslationFn } from "@/features/insights/modules/credit-card";
import type { InsightsResult } from "@/features/insights/types";
import type { Database } from "@/types/database";

type WorkspaceSettingsRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "currency_code" | "show_cents"
>;

type UseInsightsV2Options = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  intlLocale: string;
  t: TranslationFn;
  referenceDate?: Date;
};

type UseInsightsV2State = {
  isLoading: boolean;
  errorMessage: string | null;
  result: InsightsResult;
  currencyFormatter: Intl.NumberFormat;
};

export function useInsightsV2({
  supabase,
  workspaceId,
  intlLocale,
  t,
  referenceDate,
}: UseInsightsV2Options): UseInsightsV2State {
  const effectiveReferenceDate = useMemo(() => referenceDate ?? new Date(), [referenceDate]);
  const fallbackFormatter = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [intlLocale],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettingsRow>({
    currency_code: "ARS",
    show_cents: false,
  });
  const [result, setResult] = useState<InsightsResult>({
    allInsights: [],
    primaryInsight: null,
    modules: [],
  });

  const currencyFormatter = useMemo(
    () =>
      buildSafeCurrencyFormatter(
        intlLocale,
        settings.currency_code ?? "ARS",
        settings.show_cents ?? false,
        fallbackFormatter,
      ),
    [fallbackFormatter, intlLocale, settings.currency_code, settings.show_cents],
  );

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const settingsResponse = await supabase
          .from("workspace_settings")
          .select("currency_code, show_cents")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (settingsResponse.error) {
          throw settingsResponse.error;
        }

        const safeSettings = (settingsResponse.data ?? {
          currency_code: "ARS",
          show_cents: false,
        }) as WorkspaceSettingsRow;

        const loadedContext = await loadInsightsContext({
          supabase,
          workspaceId,
          referenceDate: effectiveReferenceDate,
        });

        if (isCancelled) {
          return;
        }

        setSettings(safeSettings);
        const localFormatter = buildSafeCurrencyFormatter(
          intlLocale,
          safeSettings.currency_code ?? "ARS",
          safeSettings.show_cents ?? false,
          fallbackFormatter,
        );
        setResult(
          buildInsightsResult({
            context: loadedContext,
            t,
            currencyFormatter: localFormatter,
          }),
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setResult({
          allInsights: [],
          primaryInsight: null,
          modules: [],
        });
        setErrorMessage(error instanceof Error ? error.message : "Unknown insights error");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [effectiveReferenceDate, fallbackFormatter, intlLocale, supabase, t, workspaceId]);

  return {
    isLoading,
    errorMessage,
    result,
    currencyFormatter,
  };
}
