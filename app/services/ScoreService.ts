// =============================================================================
// ScoreService — tracks the run score. Kept separate from power so scoring
// rules can evolve independently of the weapon mechanic.
// =============================================================================
export class ScoreService {
  private _score = 0

  get score(): number {
    return this._score
  }

  reset(): void {
    this._score = 0
  }

  /** Award points (e.g. an enemy's value) and return the new total. */
  add(amount: number): number {
    this._score += Math.max(0, Math.round(amount))
    return this._score
  }
}
