// TabCraft — Shared formatting helpers

/** Rough per-tab memory estimate used for display purposes only (actual
 *  savings vary widely by tab content). Kept as a single named constant so
 *  the background hibernation stats and the side panel's quick-actions
 *  estimate can't silently drift apart if one gets tuned later. */
export const ESTIMATED_MB_PER_TAB = 50;

/** Format an estimated memory figure (in MB) as a human-readable string,
 *  switching to GB above 1024 MB. */
export function formatMemoryEstimate(tabCount: number): string {
  const mb = tabCount * ESTIMATED_MB_PER_TAB;
  return mb > 1024 ? `~${(mb / 1024).toFixed(1)} GB` : `~${mb} MB`;
}
