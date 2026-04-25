import { Box, Group, Text } from "@mantine/core";

type CategoriesInsightProps = {
  message: string;
};

export function CategoriesInsight({ message }: CategoriesInsightProps) {
  return (
    <Box
      px="sm"
      py={10}
      style={{
        borderRadius: "12px",
        border: "1px solid var(--mantine-color-gray-3)",
        backgroundColor: "var(--mantine-color-gray-0)",
      }}
    >
      <Group gap={8} wrap="nowrap">
        <Text size="sm" aria-hidden="true">
          i
        </Text>
        <Text size="sm" fw={500}>
          {message}
        </Text>
      </Group>
    </Box>
  );
}
