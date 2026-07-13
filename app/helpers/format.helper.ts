// =============================================================================
// Pure formatting utilities.
// =============================================================================

// Short-scale suffixes per 1000× step (idx 0 = ones). Covers up to 1e63; beyond
// that we fall back to clean scientific so nothing ever prints raw like "1e+72".
const UNITS = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UD', 'DD', 'TD', 'QaD', 'QiD', 'SxD', 'SpD', 'OcD', 'NoD', 'Vg',
]

/**
 * Compact number: 1200 -> "1.2K", 2.5e9 -> "2.5B", 5.24e54 -> "5.24SpD".
 * Handles arbitrarily large values (survivor scores reach 1e50+) without ever
 * showing ugly raw exponentials like "5.2e+54T".
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '0'
  const abs = Math.abs(value)
  if (abs < 1000) return `${Math.round(value)}`
  const tier = Math.floor(Math.log10(abs) / 3)
  if (tier < UNITS.length) {
    return `${trim(value / 10 ** (tier * 3))}${UNITS[tier]}`
  }
  return value.toExponential(2).replace('e+', 'e')
}

function trim(value: number): string {
  // 2 significant decimals for the big named tiers, dropping trailing zeros.
  return value.toFixed(2).replace(/\.?0+$/, '')
}
