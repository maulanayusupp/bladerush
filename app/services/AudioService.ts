// =============================================================================
// AudioService — procedural sound effects via the Web Audio API (no asset
// files). A single shared instance is used by both Phaser and the Vue HUD.
// The AudioContext must be unlocked from a user gesture (autoplay policy).
// =============================================================================
type OscType = OscillatorType

const STORAGE_KEY = 'blade-rush:audio'

class AudioService {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private _muted = false
  private _musicOn = true
  private musicVol = 0.3
  private sfxVol = 0.9
  private musicTimer: number | null = null
  private nextNoteAt = 0
  private step = 0

  constructor() {
    // Restore persisted audio preferences (safe if localStorage is unavailable).
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw) as Partial<{ muted: boolean; musicOn: boolean; musicVol: number; sfxVol: number }>
      if (typeof s.muted === 'boolean') this._muted = s.muted
      if (typeof s.musicOn === 'boolean') this._musicOn = s.musicOn
      if (typeof s.musicVol === 'number') this.musicVol = s.musicVol
      if (typeof s.sfxVol === 'number') this.sfxVol = s.sfxVol
    } catch {
      /* ignore malformed prefs */
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ muted: this._muted, musicOn: this._musicOn, musicVol: this.musicVol, sfxVol: this.sfxVol }),
    )
  }

  get muted(): boolean {
    return this._muted
  }

  get musicOn(): boolean {
    return this._musicOn
  }

  get musicVolume(): number {
    return this.musicVol
  }

  get sfxVolume(): number {
    return this.sfxVol
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
      // Music routes through its own bus into master, so the mute button still
      // silences everything while music has an independent on/off + volume.
      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = this._musicOn ? this.musicVol : 0
      this.musicBus.connect(this.master)
      // SFX route through their own bus so they get an independent volume.
      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = this.sfxVol
      this.sfxBus.connect(this.master)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.startMusic()
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.5
    this.persist()
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted)
    return this._muted
  }

  setMusicOn(on: boolean): void {
    this._musicOn = on
    if (this.musicBus) this.musicBus.gain.value = on ? this.musicVol : 0
    this.persist()
  }

  setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v))
    if (this.musicBus && this._musicOn) this.musicBus.gain.value = this.musicVol
    this.persist()
  }

  setSfxVolume(v: number): void {
    this.sfxVol = Math.max(0, Math.min(1, v))
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVol
    this.persist()
  }

  // ---- Background music: a looping 16-step ambient battle groove -----------

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return
    this.nextNoteAt = this.ctx.currentTime + 0.1
    this.step = 0
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25)
  }

  private scheduleMusic(): void {
    if (!this.ctx) return
    const stepDur = 0.17 // ~ 88 BPM sixteenths
    while (this.nextNoteAt < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteAt)
      this.nextNoteAt += stepDur
      this.step = (this.step + 1) % 16
    }
  }

  private playStep(step: number, when: number): void {
    if (this._muted || !this._musicOn || !this.musicBus) return
    // Am-pentatonic: bass on the quarter, a sparse lead arpeggio, soft hats.
    const bass = [110, 0, 0, 0, 146.83, 0, 0, 0, 130.81, 0, 0, 0, 98, 0, 0, 0]
    const lead = [440, 0, 523.25, 0, 392, 0, 659.25, 0, 523.25, 0, 440, 0, 587.33, 0, 392, 0]
    if (bass[step]) this.musicTone(bass[step] as number, 0.36, 'triangle', 0.5, when)
    if (lead[step]) this.musicTone(lead[step] as number, 0.2, 'sine', 0.2, when)
    if (step % 4 === 2) this.musicNoise(0.03, 0.05, when, 8000)
  }

  private musicTone(freq: number, dur: number, type: OscType, peak: number, when: number): void {
    if (!this.ctx || !this.musicBus) return
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(gain)
    gain.connect(this.musicBus)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  private musicNoise(dur: number, peak: number, when: number, filterHz: number): void {
    if (!this.ctx || !this.musicBus) return
    const frames = Math.floor(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = filterHz
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(peak, when)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(hp)
    hp.connect(gain)
    gain.connect(this.musicBus)
    src.start(when)
    src.stop(when + dur + 0.02)
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
    gain.connect(this.sfxBus ?? this.master)
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
    gain.connect(this.sfxBus ?? this.master)
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

  /**
   * Divine ultimate — a bespoke flourish per sonic "family" so the 20 ultimates
   * feel distinct. The caller passes the skill id; families group similar themes.
   */
  ultimate(id: string): void {
    const t = this.t
    switch (ULT_FAMILY[id] ?? 'cosmic') {
      case 'holy': // radiant ascending bell chord
        ;[659, 880, 1319, 1760].forEach((f, i) => this.beep(f, 0.45, 'triangle', 0.3, t + i * 0.05))
        this.noise(0.5, 0.1, t, 6500, 0.5)
        break
      case 'dark': // deep detuned ominous swell
        this.beep(70, 0.8, 'sawtooth', 0.42, t, 40)
        this.beep(104, 0.7, 'sine', 0.3, t, 55)
        this.noise(0.7, 0.28, t, 400, 0.6)
        break
      case 'fire': // sizzling low roar
        this.beep(180, 0.55, 'sawtooth', 0.36, t, 70)
        this.beep(90, 0.5, 'sine', 0.3, t, 50)
        this.noise(0.6, 0.42, t, 1500, 0.4)
        break
      case 'ice': // crystalline shimmer
        ;[1200, 1600, 2100, 2600].forEach((f, i) => this.beep(f, 0.32, 'sine', 0.22, t + i * 0.04))
        this.noise(0.45, 0.12, t, 7500, 0.6)
        break
      case 'thunder': // zap + crackle
        this.beep(120, 0.28, 'square', 0.32, t, 2200)
        this.noise(0.28, 0.5, t, 3000, 0.3)
        this.noise(0.16, 0.4, t + 0.12, 5200, 0.4)
        break
      case 'earth': // seismic rumble
        this.beep(58, 0.9, 'sine', 0.5, t, 38)
        this.beep(92, 0.6, 'sawtooth', 0.3, t, 52)
        this.noise(0.8, 0.32, t, 300, 0.7)
        break
      case 'nature': // organic mid bloom
        ;[330, 440, 550].forEach((f, i) => this.beep(f, 0.4, 'triangle', 0.26, t + i * 0.06))
        this.noise(0.5, 0.16, t, 2000, 0.5)
        break
      default: // cosmic — grand layered boom
        this.beep(140, 0.6, 'sine', 0.4, t, 60)
        ;[523, 784, 1047].forEach((f, i) => this.beep(f, 0.4, 'triangle', 0.24, t + i * 0.05))
        this.noise(0.55, 0.3, t, 1200, 0.5)
    }
  }
}

/** Maps each Divine ultimate id to a sonic family (see AudioService.ultimate). */
const ULT_FAMILY: Record<string, string> = {
  seraph: 'holy', solar: 'holy',
  void: 'dark', lunar: 'dark', chaos: 'dark', reaper: 'dark',
  inferno: 'fire', dragon: 'fire', blood: 'fire',
  frost: 'ice', chrono: 'ice', tide: 'ice',
  storm: 'thunder', tempest: 'thunder', prism: 'thunder',
  quake: 'earth', emperor: 'earth',
  nature: 'nature', plague: 'nature',
  cosmic: 'cosmic',
}

/** Shared singleton. */
export const audioService = new AudioService()
