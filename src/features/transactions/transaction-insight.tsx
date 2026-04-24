"use client";

import { Group, Paper, Text } from "@mantine/core";

type TransactionInsightProps = {
  title: string;
  detail: string;
};

export function TransactionInsight({ title, detail }: TransactionInsightProps) {
  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      style={{
        background:
          "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0.03) 100%)",
        borderColor: "var(--mantine-color-cyan-2)",
      }}
    >
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Text
          component="span"
          aria-hidden="true"
          style={{ fontSize: "1rem", lineHeight: 1.2, paddingTop: "0.1rem" }}
        >
          {"\u{1F4A1}"}
        </Text>
        <Text size="sm" style={{ lineHeight: 1.45 }}>
          <Text component="span" fw={700} c="cyan.8">
            {title}
          </Text>{" "}
          <Text component="span" c="dimmed">
            {detail}
          </Text>
        </Text>
      </Group>
    </Paper>
  );
}
