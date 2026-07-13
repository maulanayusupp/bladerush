// =============================================================================
// CodexService — persistent record of which unit/weapon variations the player
// has DISCOVERED (heroes reached, rivals/troops/bosses defeated, weapons used).
// Backs the Codex gallery's progress + locked silhouettes. localStorage-backed.
// =============================================================================
export type CodexCategory = 'hero' | 'rival' | 'troop' | 'boss' | 'weapon'

const STORAGE_KEY = 'blade-rush:codex'
const CATEGORIES: CodexCategory[] = ['hero', 'rival', 'troop', 'boss', 'weapon']

class CodexService {
  private seen: Record<CodexCategory, Set<number>> = {
    hero: new Set(),
    rival: new Set(),
    troop: new Set(),
    boss: new Set(),
    weapon: new Set(),
  }
  private loaded = false

  load(): void {
    if (this.loaded || typeof localStorage === 'undefined') return
    this.loaded = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Record<string, number[]>
      for (const cat of CATEGORIES) {
        if (Array.isArray(data[cat])) this.seen[cat] = new Set(data[cat])
      }
    } catch {
      // Corrupt payload — start fresh.
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') return
    const data: Record<string, number[]> = {}
    for (const cat of CATEGORIES) data[cat] = [...this.seen[cat]]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  /** Record a discovery. @returns true if it was NEW. */
  mark(category: CodexCategory, index: number): boolean {
    if (index < 0 || Number.isNaN(index)) return false
    this.load()
    const set = this.seen[category]
    if (set.has(index)) return false
    set.add(index)
    this.save()
    return true
  }

  /** Parse a texture key like "troop37" and mark it discovered. */
  markKey(category: CodexCategory, textureKey: string, prefix: string): boolean {
    const idx = Number.parseInt(textureKey.slice(prefix.length), 10)
    return this.mark(category, idx)
  }

  has(category: CodexCategory, index: number): boolean {
    this.load()
    return this.seen[category].has(index)
  }

  count(category: CodexCategory): number {
    this.load()
    return this.seen[category].size
  }
}

/** Shared singleton. */
export const codexService = new CodexService()
