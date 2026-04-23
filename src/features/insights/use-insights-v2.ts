"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSafeCurrencyFormatter } from "@/features/dashboard/lib/dashboard-math";
import { buildInsightsResult } from "@/features/insights/engine";
import { loadInsightsContext } from "@/features/insights/data";
import type { TranslationFn } from "@/features/insights/intl";
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
  const emptyResult: InsightsResult = useMemo(
    () => ({
      financialState: {
        level: "stable",
        title: t("insightsV2.financialState.levels.stable.title"),
        message: t("insightsV2.financialState.levels.stable.messageNoIncome", undefined, {
          availableAmount: fallbackFormatter.format(0),
          futurePressureAmount: fallbackFormatter.format(0),
          projectedVariableExpense: fallbackFormatter.format(0),
          projectedBalance: fallbackFormatter.format(0),
          pressureRatio: "-",
        }),
        pressureScore: 0,
        data: {
          availableCurrent: 0,
          futurePressureAmount: 0,
          futurePressureVsIncome: null,
          projectedExpenseVariable: 0,
          projectedBalance: 0,
        },
      },
      allInsights: [],
      primaryInsight: null,
      modules: [],
    }),
    [fallbackFormatter, t],
  );
  const [result, setResult] = useState<InsightsResult>(emptyResult);

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
    setResult((currentResult) => {
      if (
        currentResult.modules.length > 0 ||
        currentResult.primaryInsight !== null ||
        currentResult.allInsights.length > 0
      ) {
        return currentResult;
      }

      return emptyResult;
    });
  }, [emptyResult]);

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

        setResult(emptyResult);
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
  }, [effectiveReferenceDate, emptyResult, fallbackFormatter, intlLocale, supabase, t, workspaceId]);

  return {
    isLoading,
    errorMessage,
    result,
    currencyFormatter,
  };
}
