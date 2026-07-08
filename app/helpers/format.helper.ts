// =============================================================================
// Pure formatting utilities.
// =============================================================================

/** 1200 -> "1.2K", 3_400_000 -> "3.4M", 7_950_468 -> "8M", 2.5e9 -> "2.5B". */
export function formatCompact(value: number): string {
  if (value >= 1e12) return `${trim(value / 1e12)}T`
  if (value >= 1e9) return `${trim(value / 1e9)}B`
  if (value >= 1e6) return `${trim(value / 1e6)}M`
  if (value >= 1e3) return `${trim(value / 1e3)}K`
  return `${Math.round(value)}`
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}
