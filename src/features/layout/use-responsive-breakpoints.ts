"use client";

import { useMediaQuery } from "@mantine/hooks";

// Server render and first client render assume mobile so iOS Safari never
// lays out the desktop grid at 375 px; Mantine's effect corrects it on desktop.
const MOBILE_QUERY = "(max-width: 47.99em)";
const NARROW_MOBILE_QUERY = "(max-width: 33.99em)";

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY, true);
}

export function useIsNarrowMobile(): boolean {
  return useMediaQuery(NARROW_MOBILE_QUERY, true);
}
