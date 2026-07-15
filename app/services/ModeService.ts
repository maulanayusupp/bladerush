// =============================================================================
// ModeService — the game mode the player selected on the menu. Persisted and
// read by BattleScene at run start. Pure business layer (no Phaser/Vue).
// =============================================================================
export type GameMode = 'normal' | 'endless' | 'bossrush' | 'timeattack'

export const GAME_MODES: GameMode[] = ['normal', 'endless', 'bossrush', 'timeattack']

/** Time-attack run length (ms). */
export const TIME_ATTACK_MS = 5 * 60 * 1000

const STORAGE_KEY = 'blade-rush:mode'

class ModeService {
  private _mode: GameMode = 'normal'
  private loaded = false

  private load(): void {
    if (this.loaded || typeof localStorage === 'undefined') return
    this.loaded = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && (GAME_MODES as string[]).includes(raw)) this._mode = raw as GameMode
  }

  get mode(): GameMode {
    this.load()
    return this._mode
  }

  setMode(mode: GameMode): void {
    this.load()
    this._mode = mode
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode)
  }
}

/** Shared singleton. */
export const modeService = new ModeService()
