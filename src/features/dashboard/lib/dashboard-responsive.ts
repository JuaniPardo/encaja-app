"use client";

import { useMediaQuery } from "@mantine/hooks";

type DashboardTableColumnWidths = {
  category: string;
  real: string;
  budget?: string;
  execution: string;
  deviation: string;
};

export type DashboardResponsiveState = {
  isMobile: boolean;
  isNarrowMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  kpiColumns: number;
  distributionColumns: number;
  cardPadding: "xs" | "sm";
  tableHorizontalSpacing: "xs" | "sm";
  tableVerticalSpacing: number;
  executionBarWidth: number | string;
  donutSize: number;
  donutThickness: number;
  compactSummaryDonutSize: number;
  compactSummaryDonutThickness: number;
  tableColumnWidths: DashboardTableColumnWidths;
};

export function useDashboardResponsive(): DashboardResponsiveState {
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const isNarrowMobile = useMediaQuery("(max-width: 33.99em)");
  const isTablet = useMediaQuery("(min-width: 48em) and (max-width: 74.99em)");

  const kpiColumns = isMobile ? (isNarrowMobile ? 1 : 2) : 2;
  const distributionColumns = isMobile ? 1 : 3;
  const isDesktop = !isMobile && !isTablet;
  const cardPadding = isMobile ? "xs" : "sm";
  const tableHorizontalSpacing = isMobile ? "xs" : "sm";
  const tableVerticalSpacing = isMobile ? 5 : 6;
  const executionBarWidth = isMobile ? "100%" : isTablet ? 88 : 96;
  const donutSize = isMobile ? 76 : isTablet ? 108 : 120;
  const donutThickness = isMobile ? 9 : isTablet ? 12 : 14;
  const compactSummaryDonutSize = isNarrowMobile ? 80 : 96;
  const compactSummaryDonutThickness = isNarrowMobile ? 10 : 12;

  const tableColumnWidths = isMobile
    ? {
        category: "38%",
        real: "16%",
        execution: "24%",
        deviation: "22%",
      }
    : isTablet
      ? {
          category: "33%",
          real: "17%",
          budget: "17%",
          execution: "20%",
          deviation: "13%",
        }
      : {
          category: "35%",
          real: "17%",
          budget: "17%",
          execution: "18%",
          deviation: "13%",
        };

  return {
    isMobile,
    isNarrowMobile,
    isTablet,
    isDesktop,
    kpiColumns,
    distributionColumns,
    cardPadding,
    tableHorizontalSpacing,
    tableVerticalSpacing,
    executionBarWidth,
    donutSize,
    donutThickness,
    compactSummaryDonutSize,
    compactSummaryDonutThickness,
    tableColumnWidths,
  };
}
