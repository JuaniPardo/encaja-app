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
  if (type === "income") {
    if (value > 100) {
      return {
        fill: "#0f766e",
        track: "#ccfbf1",
        border: "#99f6e4",
        text: "#ffffff",
      };
    }

    if (value === 100) {
      return {
        fill: "#94a3b8",
        track: "#f1f5f9",
        border: "#e2e8f0",
        text: "#334155",
      };
    }

    return {
      fill: "#fb7185",
      track: "#fff1f2",
      border: "#fecdd3",
      text: value < 35 ? "#9f1239" : "#ffffff",
    };
  }

  if (type === "expense") {
    if (value > 100) {
      return {
        fill: "#be185d",
        track: "#fce7f3",
        border: "#f9a8d4",
        text: "#ffffff",
      };
    }

    if (value === 100) {
      return {
        fill: "#94a3b8",
        track: "#f1f5f9",
        border: "#e2e8f0",
        text: "#334155",
      };
    }

    if (value >= 80) {
      return {
        fill: "#5eead4",
        track: "#ccfbf1",
        border: "#99f6e4",
        text: "#ffffff",
      };
    }

    return {
      fill: "#14b8a6",
      track: "#ccfbf1",
      border: "#99f6e4",
      text: value < 35 ? "#134e4a" : "#ffffff",
    };
  }

  if (value > 100) {
    return {
      fill: "#4338ca",
      track: "#e0e7ff",
      border: "#c7d2fe",
      text: "#ffffff",
    };
  }

  if (value === 100) {
    return {
      fill: "#94a3b8",
      track: "#f1f5f9",
      border: "#e2e8f0",
      text: "#334155",
    };
  }

  return {
    fill: "#fb7185",
    track: "#fff1f2",
    border: "#fecdd3",
    text: value < 35 ? "#9f1239" : "#ffffff",
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
