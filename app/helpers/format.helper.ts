// =============================================================================
// Pure formatting utilities.
// =============================================================================

/** 1200 -> "1.2K", 3_400_000 -> "3.4M". */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`
  if (value >= 1_000) return `${trim(value / 1_000)}K`
  return `${Math.round(value)}`
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}
