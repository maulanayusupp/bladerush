// =============================================================================
// Typed event bus — the ONLY channel between the Phaser world and Vue DOM.
// A single shared instance is imported by both sides. Using events (instead of
// Vue reactivity per frame) keeps the render loop cheap.
// =============================================================================
import type { GameEventMap } from '~/types/game'

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void
type AnyHandler = (payload: never) => void

class TypedEventBus {
  // Internally untyped per-event; the public API below keeps callers type-safe.
  private readonly handlers = new Map<keyof GameEventMap, Set<AnyHandler>>()

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof GameEventMap>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set<AnyHandler>()
      this.handlers.set(event, set)
    }
    set.add(handler as AnyHandler)
    return () => this.off(event, handler)
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as AnyHandler)
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.handlers.get(event)?.forEach((handler) => (handler as Handler<K>)(payload))
  }
}

/** Shared singleton. */
export const gameEventBus = new TypedEventBus()
