import type { Insight, InsightSeverity } from "@/features/insights/types";

const severityWeight: Record<InsightSeverity, number> = {
  alert: 4,
  warning: 3,
  info: 2,
  positive: 1,
};

export function resolveInsightSeverityWeight(severity: InsightSeverity) {
  return severityWeight[severity];
}

export function compareInsightsByPriority(left: Insight, right: Insight) {
  const severityDiff = resolveInsightSeverityWeight(right.severity) - resolveInsightSeverityWeight(left.severity);
  if (severityDiff !== 0) {
    return severityDiff;
  }

  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  return left.id.localeCompare(right.id);
}
