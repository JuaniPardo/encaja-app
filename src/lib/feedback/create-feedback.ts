import type { SupabaseClient } from "@supabase/supabase-js";

import type { FeedbackType, Database } from "@/types/database";

interface CreateFeedbackOptions {
  supabase: SupabaseClient<Database>;
  workspaceId: string | null;
  type: FeedbackType;
  message: string;
  route: string | null;
}

function normalizeRoute(route: string | null) {
  if (!route) {
    return null;
  }

  const normalizedRoute = route.trim();
  return normalizedRoute.length > 0 ? normalizedRoute : null;
}

export async function createFeedback({
  supabase,
  workspaceId,
  type,
  message,
  route,
}: CreateFeedbackOptions) {
  const response = await supabase.from("feedback").insert({
    workspace_id: workspaceId,
    type,
    message: message.trim(),
    route: normalizeRoute(route),
  });

  if (response.error) {
    throw response.error;
  }
}
