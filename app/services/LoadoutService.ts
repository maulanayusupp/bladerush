// =============================================================================
// LoadoutService — the hero the player has chosen to start as (from the Codex).
// -1 means "auto" (start humble and evolve with score). Persisted.
// =============================================================================
const STORAGE_KEY = 'blade-rush:loadout'

class LoadoutService {
  private hero = -1
  private loaded = false

  load(): void {
    if (this.loaded || typeof localStorage === 'undefined') return
    this.loaded = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) this.hero = Number(raw)
  }

  get selectedHero(): number {
    this.load()
    return this.hero
  }

  setHero(index: number): void {
    this.load()
    this.hero = index
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(index))
  }
}

export const loadoutService = new LoadoutService()
