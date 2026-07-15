// =============================================================================
// SettingsService — persisted gameplay/accessibility preferences shared between
// the Vue HUD and the Phaser scene. No Phaser/Vue imports (pure business layer).
// =============================================================================
const STORAGE_KEY = 'blade-rush:settings'

class SettingsService {
  private _screenShake = true
  private loaded = false

  private load(): void {
    if (this.loaded || typeof localStorage === 'undefined') return
    this.loaded = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw) as Partial<{ screenShake: boolean }>
      if (typeof s.screenShake === 'boolean') this._screenShake = s.screenShake
    } catch {
      /* ignore malformed prefs */
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ screenShake: this._screenShake }))
  }

  get screenShake(): boolean {
    this.load()
    return this._screenShake
  }

  setScreenShake(on: boolean): void {
    this.load()
    this._screenShake = on
    this.persist()
  }
}

/** Shared singleton. */
export const settingsService = new SettingsService()
