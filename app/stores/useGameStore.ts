// =============================================================================
// Pinia store for cross-page UI state (persistent high score). Fast, per-frame
// gameplay state lives in Phaser + EventBus, NOT here.
// =============================================================================
import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'blade-rush:high-score'

export const useGameStore = defineStore('game', () => {
  const highScore = ref(0)
  const lastScore = ref(0)

  function loadHighScore(): void {
    if (import.meta.client) {
      highScore.value = Number(localStorage.getItem(STORAGE_KEY)) || 0
    }
  }

  function recordScore(score: number): void {
    lastScore.value = score
    if (score > highScore.value) {
      highScore.value = score
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, String(score))
    }
  }

  return { highScore, lastScore, loadHighScore, recordScore }
})
