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

function resolveFallbackUrgency(insight: Insight) {
  return resolveInsightSeverityWeight(insight.severity);
}

function resolveFallbackImpact(insight: Insight) {
  return Math.max(1, Math.round(insight.priority / 250));
}

export function compareInsightsByPriority(left: Insight, right: Insight) {
  const severityDiff = resolveInsightSeverityWeight(right.severity) - resolveInsightSeverityWeight(left.severity);
  if (severityDiff !== 0) {
    return severityDiff;
  }

  const urgencyDiff = (right.urgency ?? resolveFallbackUrgency(right)) - (left.urgency ?? resolveFallbackUrgency(left));
  if (urgencyDiff !== 0) {
    return urgencyDiff;
  }

  const impactDiff = (right.impact ?? resolveFallbackImpact(right)) - (left.impact ?? resolveFallbackImpact(left));
  if (impactDiff !== 0) {
    return impactDiff;
  }

  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  return left.id.localeCompare(right.id);
}
