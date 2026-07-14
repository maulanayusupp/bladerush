// =============================================================================
// AchievementService — one-time milestones evaluated at the end of a run. Each
// unlock grants coins (once ever) via MetaService. localStorage-backed.
// =============================================================================
import { ACHIEVEMENTS } from '~/game/constants'
import type { RunStats } from '~/types/game'
import { metaService } from './MetaService'

const STORAGE_KEY = 'blade-rush:achievements'

/** Everything the evaluator can test against (RunStats + final power). */
export interface RunContext extends RunStats {
  power: number
}

class AchievementService {
  private unlocked = new Set<string>()
  private loaded = false

  load(): void {
    if (this.loaded || typeof localStorage === 'undefined') return
    this.loaded = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) this.unlocked = new Set(JSON.parse(raw) as string[])
    } catch {
      // ignore corrupt storage
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]))
  }

  has(id: string): boolean {
    this.load()
    return this.unlocked.has(id)
  }

  get count(): number {
    this.load()
    return this.unlocked.size
  }

  get total(): number {
    return ACHIEVEMENTS.length
  }

  private value(ctx: RunContext, metric: string): number {
    if (metric === 'power') return ctx.power
    if (metric === 'rank1') return ctx.bestRank <= 1 ? 1 : 0
    return (ctx as unknown as Record<string, number>)[metric] ?? 0
  }

  /**
   * Evaluate a finished run: unlock any newly-earned achievements, award their
   * coins, and return the newly-unlocked ids (for display).
   */
  evaluate(ctx: RunContext): string[] {
    this.load()
    const fresh: string[] = []
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id)) continue
      if (this.value(ctx, a.metric) >= a.value) {
        this.unlocked.add(a.id)
        metaService.addCoins(a.reward)
        fresh.push(a.id)
      }
    }
    if (fresh.length) this.save()
    return fresh
  }
}

export const achievementService = new AchievementService()
