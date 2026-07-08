// =============================================================================
// AudioService — procedural sound effects via the Web Audio API (no asset
// files). A single shared instance is used by both Phaser and the Vue HUD.
// The AudioContext must be unlocked from a user gesture (autoplay policy).
// =============================================================================
type OscType = OscillatorType

class AudioService {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private _muted = false

  get muted(): boolean {
    return this._muted
  }

  /** Create/resume the context. Call from a user gesture (click/tap). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this._muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.5
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted)
    return this._muted
  }

  private get t(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /** A single enveloped oscillator note. */
  private beep(freq: number, dur: number, type: OscType, peak: number, when: number, slideTo?: number): void {
    if (!this.ctx || !this.master || this._muted) return
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  /** A band-passed white-noise burst (metallic transient / crash). */
  private noise(dur: number, peak: number, when: number, filterHz: number, q: number): void {
    if (!this.ctx || !this.master || this._muted) return
    const frames = Math.floor(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = filterHz
    bp.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(peak, when)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(bp)
    bp.connect(gain)
    gain.connect(this.master)
    src.start(when)
    src.stop(when + dur + 0.02)
  }

  /** Metallic sword clang ("ting"). */
  clash(): void {
    const t = this.t
    this.beep(2100, 0.18, 'triangle', 0.35, t, 1700)
    this.beep(3140, 0.16, 'sine', 0.22, t, 2500)
    this.beep(4300, 0.12, 'sine', 0.15, t)
    this.noise(0.05, 0.3, t, 4200, 0.8)
  }

  /** Rising chime when passing a gate. */
  pickup(): void {
    const t = this.t
    this.beep(520, 0.09, 'square', 0.28, t, 700)
    this.beep(780, 0.1, 'square', 0.26, t + 0.07, 980)
  }

  /** Light tick when a sword connects. */
  hit(): void {
    this.beep(820, 0.05, 'triangle', 0.16, this.t, 620)
  }

  /** Enemy destroyed. */
  death(): void {
    const t = this.t
    this.beep(300, 0.14, 'sawtooth', 0.28, t, 120)
    this.noise(0.12, 0.2, t, 900, 0.8)
  }

  /** Player took contact damage. */
  hurt(): void {
    this.beep(180, 0.16, 'sawtooth', 0.34, this.t, 90)
  }

  /** Rival duel won — bright ascending arpeggio. */
  win(): void {
    const t = this.t
    ;[523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.16, 'triangle', 0.3, t + i * 0.07))
    this.noise(0.4, 0.12, t, 5000, 0.5)
  }

  /** Fury skill — a rising power-up whoosh. */
  skill(): void {
    const t = this.t
    this.beep(300, 0.28, 'sawtooth', 0.28, t, 1200)
    this.beep(600, 0.24, 'triangle', 0.22, t + 0.04, 1600)
    this.noise(0.3, 0.12, t, 3200, 0.6)
  }

  /** Nova shockwave — a deep boom. */
  nova(): void {
    const t = this.t
    this.beep(140, 0.5, 'sine', 0.4, t, 60)
    this.beep(220, 0.4, 'sawtooth', 0.25, t, 90)
    this.noise(0.45, 0.35, t, 800, 0.5)
  }

  /** Rival duel lost — descending crash. */
  lose(): void {
    const t = this.t
    ;[440, 330, 247, 165].forEach((f, i) => this.beep(f, 0.22, 'sawtooth', 0.32, t + i * 0.09))
    this.noise(0.5, 0.3, t, 600, 0.7)
  }
}

/** Shared singleton. */
export const audioService = new AudioService()
