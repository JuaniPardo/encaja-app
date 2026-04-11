"use client";

import { Box, Text } from "@mantine/core";

import type { TransactionType } from "@/types/database";

type ProgressCellProps = {
  type: TransactionType;
  value: number | null;
  percentageFormatter: Intl.NumberFormat;
  compact?: boolean;
};

type ProgressVisualScale = {
  fill: string;
  track: string;
  border: string;
  text: string;
};

function clampToPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return value;
}

function getProgressVisualScale(type: TransactionType, value: number): ProgressVisualScale {
  if (value < 100) {
    return {
      fill: "#64748b",
      track: "#e2e8f0",
      border: "#cbd5e1",
      text: value < 40 ? "#0f172a" : "#ffffff",
    };
  }

  const targetColors: Record<
    TransactionType,
    {
      reached: string;
      exceeded: string;
    }
  > = {
    income: {
      reached: "#22c55e",
      exceeded: "#15803d",
    },
    expense: {
      reached: "#ec4899",
      exceeded: "#be185d",
    },
    saving: {
      reached: "#6366f1",
      exceeded: "#4338ca",
    },
  };

  return {
    fill: value > 100 ? targetColors[type].exceeded : targetColors[type].reached,
    track: "#e2e8f0",
    border: "#cbd5e1",
    text: "#ffffff",
  };
}

export function ProgressCell({ type, value, percentageFormatter, compact = false }: ProgressCellProps) {
  const height = compact ? 14 : 16;
  const fontSize = compact ? "10px" : "11px";

  if (value === null) {
    return (
      <Box
        style={{
          height,
          borderRadius: 6,
          backgroundColor: "#f1f5f9",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text size={fontSize} fw={700} c="#64748b" style={{ lineHeight: 1 }}>
          N/A
        </Text>
      </Box>
    );
  }

  const visualPercent = clampToPercent(value);
  const displayPercent = `${percentageFormatter.format(value)}%`;
  const scale = getProgressVisualScale(type, value);

  return (
    <Box
      style={{
        height,
        borderRadius: 6,
        backgroundColor: scale.track,
        border: `1px solid ${scale.border}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          width: `${visualPercent}%`,
          backgroundColor: scale.fill,
          transition: "width 160ms ease",
          borderRadius: 5,
        }}
      />
      <Text
        size={fontSize}
        fw={700}
        ta="center"
        style={{
          position: "relative",
          zIndex: 1,
          color: scale.text,
          lineHeight: `${height - 2}px`,
          whiteSpace: "nowrap",
          textShadow: scale.text === "#ffffff" ? "0 1px 1px rgba(0,0,0,0.25)" : "none",
        }}
      >
        {displayPercent}
      </Text>
    </Box>
  );
}
