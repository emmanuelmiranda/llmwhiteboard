/**
 * SoundEngine - A Mini Synthesizer
 *
 * Full synth engine for pixel-progress with:
 * - Multiple oscillators with detuning
 * - ADSR envelopes
 * - LFO modulation (pitch/amplitude)
 * - Filters (lowpass/highpass)
 * - Delay effect
 *
 * Each event category has its own "patch" (synth preset).
 *
 * Progressive Configuration Mode:
 * First N events (configurationPhaseCount) play stock sounds while also
 * "configuring" the synth parameters. After configuration is complete,
 * subsequent events play musical notes using the configured synth.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SoundEngineConfig {
  enabled: boolean
  masterVolume: number // 0-1
  muted: boolean
  /** Enable progressive configuration mode */
  progressiveMode: boolean
  /** Number of events in the configuration phase */
  configurationPhaseCount: number
}

// Configuration slots that early events fill in
export interface SynthConfiguration {
  oscillatorType: OscillatorType
  oscillatorDetune: number
  filterType: BiquadFilterType
  filterFrequency: number
  filterQ: number
  lfoEnabled: boolean
  lfoFrequency: number
  lfoDepth: number
  lfoTarget: 'pitch' | 'amplitude' | 'filter'
  delayEnabled: boolean
  delayTime: number
  delayFeedback: number
  envelopeAttack: number
  envelopeDecay: number
  envelopeSustain: number
  envelopeRelease: number
}

export interface ADSREnvelope {
  attack: number   // seconds
  decay: number    // seconds
  sustain: number  // 0-1 level
  release: number  // seconds
}

export interface LFOConfig {
  frequency: number      // Hz
  depth: number          // 0-1
  target: 'pitch' | 'amplitude' | 'filter'
  waveform: OscillatorType
}

export interface FilterConfig {
  type: BiquadFilterType
  frequency: number  // Hz
  Q: number          // resonance
}

export interface SynthPatch {
  oscillators: Array<{
    type: OscillatorType
    detune: number  // cents
    volume: number  // 0-1
  }>
  envelope: ADSREnvelope
  filter?: FilterConfig
  lfo?: LFOConfig
  delay?: {
    time: number    // seconds
    feedback: number // 0-1
    mix: number     // 0-1 wet/dry
  }
}

export type SoundType =
  | 'place'
  | 'snap'
  | 'complete'
  | 'error'
  | 'input'
  | 'waiting'
  | 'success'

// =============================================================================
// MUSICAL SCALE
// =============================================================================

// Full chromatic scale (C3 to C6)
const SCALE_FREQUENCIES: Record<string, number> = {
  // Octave 3
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56,
  'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00,
  'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  // Octave 4
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
  'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  // Octave 5
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25,
  'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99,
  'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
  // Octave 6
  'C6': 1046.50,
}

// Map categories to notes - each category gets a unique note
const CATEGORY_NOTES: Record<string, string> = {
  start: 'C4',
  create: 'E4',
  modify: 'D4',
  execute: 'A4',
  search: 'G4',
  analyze: 'E5',   // Unique: was G4
  process: 'A3',   // Unique: was D4
  input: 'C5',
  wait: 'G3',      // Unique: was E4
  success: 'C6',   // Unique: was E5
  error: 'D3',     // Unique: was C3
  end: 'G5',       // Unique: was C5
  optimize: 'C3',  // Low rumble for compaction
  default: 'A5',   // Unique: was E4
}

// Tool-specific notes - override category note for specific tools
// This ensures different tools have unique sounds even if they share a category
const TOOL_NOTES: Record<string, string> = {
  // File reading/searching - spread across scale
  Read: 'E5',
  Glob: 'G4',
  Grep: 'A4',
  // File writing/editing
  Write: 'E4',
  Edit: 'D4',
  NotebookEdit: 'D5',
  // Execution
  Bash: 'A4',
  // Communication
  AskUserQuestion: 'C5',
  // Planning/organization
  TodoWrite: 'G3',
  Task: 'A3',
  // Web
  WebFetch: 'D5',
  WebSearch: 'G5',
}

// Configuration options for progressive mode
// Each category maps to which synth parameter it configures
const CONFIGURATION_MAPPINGS: Record<string, keyof SynthConfiguration> = {
  start: 'oscillatorType',
  create: 'filterType',
  modify: 'lfoEnabled',
  execute: 'delayEnabled',
  search: 'filterFrequency',
  analyze: 'lfoFrequency',
  process: 'envelopeDecay',
  input: 'filterQ',
  wait: 'lfoDepth',
  success: 'envelopeSustain',
  error: 'oscillatorDetune',
  end: 'envelopeRelease',
}

// Value options for each configuration parameter
const OSCILLATOR_TYPES: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth']
const FILTER_TYPES: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch']

// Stock sounds for configuration phase - soft, gentle sounds
const STOCK_SOUNDS: Record<string, SynthPatch> = {
  click: {
    oscillators: [{ type: 'sine', detune: 0, volume: 0.4 }],
    envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.1 },
    filter: { type: 'lowpass', frequency: 1200, Q: 0.5 },
  },
  blip: {
    oscillators: [{ type: 'sine', detune: 0, volume: 0.4 }],
    envelope: { attack: 0.02, decay: 0.1, sustain: 0, release: 0.1 },
    filter: { type: 'lowpass', frequency: 1000, Q: 0.8 },
  },
  tick: {
    oscillators: [{ type: 'triangle', detune: 0, volume: 0.35 }],
    envelope: { attack: 0.01, decay: 0.06, sustain: 0, release: 0.08 },
    filter: { type: 'lowpass', frequency: 1100, Q: 0.5 },
  },
  pop: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.4 },
      { type: 'sine', detune: 1200, volume: 0.15 },
    ],
    envelope: { attack: 0.015, decay: 0.12, sustain: 0, release: 0.12 },
    filter: { type: 'lowpass', frequency: 1300, Q: 0.6 },
  },
  ding: {
    oscillators: [{ type: 'sine', detune: 0, volume: 0.45 }],
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.05, release: 0.3 },
    filter: { type: 'lowpass', frequency: 1500, Q: 0.8 },
  },
}

// =============================================================================
// SYNTH PATCHES (Presets for each category)
// =============================================================================

const PATCHES: Record<string, SynthPatch> = {
  // Default brick placement - soft, gentle click like wooden blocks
  default: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.45 },
      { type: 'triangle', detune: 3, volume: 0.25 },
    ],
    envelope: { attack: 0.02, decay: 0.12, sustain: 0, release: 0.15 },
    filter: { type: 'lowpass', frequency: 1200, Q: 0.5 },
  },

  // Create - warm, satisfying plop
  create: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.5 },
      { type: 'sine', detune: 5, volume: 0.25 },
    ],
    envelope: { attack: 0.03, decay: 0.18, sustain: 0.1, release: 0.25 },
    filter: { type: 'lowpass', frequency: 1500, Q: 1 },
  },

  // Execute - soft tap
  execute: {
    oscillators: [
      { type: 'triangle', detune: 0, volume: 0.35 },
      { type: 'sine', detune: -3, volume: 0.25 },
    ],
    envelope: { attack: 0.015, decay: 0.1, sustain: 0, release: 0.1 },
    filter: { type: 'lowpass', frequency: 1000, Q: 0.7 },
  },

  // Search/Analyze - gentle chime
  search: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.4 },
    ],
    envelope: { attack: 0.08, decay: 0.25, sustain: 0.15, release: 0.35 },
    filter: { type: 'lowpass', frequency: 900, Q: 1 },
  },

  // Input - soft bell
  input: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.45 },
      { type: 'sine', detune: 1200, volume: 0.15 }, // Soft octave
    ],
    envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.4 },
    filter: { type: 'lowpass', frequency: 1400, Q: 0.8 },
  },

  // Wait - very gentle pad
  wait: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.3 },
    ],
    envelope: { attack: 0.15, decay: 0.3, sustain: 0.2, release: 0.5 },
    filter: { type: 'lowpass', frequency: 600, Q: 0.5 },
  },

  // Error - soft low tone (not harsh)
  error: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.35 },
      { type: 'triangle', detune: 25, volume: 0.2 },
    ],
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.1, release: 0.15 },
    filter: { type: 'lowpass', frequency: 500, Q: 1 },
  },

  // Success - warm chime
  success: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.45 },
      { type: 'sine', detune: 700, volume: 0.2 }, // Soft fifth
    ],
    envelope: { attack: 0.03, decay: 0.35, sustain: 0.2, release: 0.5 },
    filter: { type: 'lowpass', frequency: 1600, Q: 0.8 },
  },

  // Complete - gentle celebration
  complete: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.5 },
      { type: 'triangle', detune: 3, volume: 0.25 },
    ],
    envelope: { attack: 0.05, decay: 0.4, sustain: 0.2, release: 0.6 },
    filter: { type: 'lowpass', frequency: 1400, Q: 0.7 },
    delay: { time: 0.2, feedback: 0.3, mix: 0.2 },
  },

  // Optimize/Compaction - dramatic low rumble with impact
  optimize: {
    oscillators: [
      { type: 'sine', detune: 0, volume: 0.6 },
      { type: 'sine', detune: -1200, volume: 0.4 },  // One octave down
      { type: 'triangle', detune: 5, volume: 0.3 },
    ],
    envelope: { attack: 0.02, decay: 0.6, sustain: 0.3, release: 0.8 },  // Longer duration
    filter: { type: 'lowpass', frequency: 400, Q: 2 },  // Deep rumble
    delay: { time: 0.15, feedback: 0.4, mix: 0.3 },
  },
}

// =============================================================================
// SOUND ENGINE
// =============================================================================

export class SoundEngine {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private config: SoundEngineConfig
  private lastPlayTime: number = 0
  private minInterval: number = 40 // Minimum ms between sounds

  // Progressive mode state
  private eventCount: number = 0
  private synthConfig: SynthConfiguration
  private isConfigured: boolean = false
  private configurationLog: string[] = [] // Track what was configured

  constructor(config: Partial<SoundEngineConfig> = {}) {
    this.config = {
      enabled: true,
      masterVolume: 0.3,
      muted: false,
      progressiveMode: false,
      configurationPhaseCount: 5,
      ...config,
    }

    // Initialize default synth configuration
    this.synthConfig = this.getDefaultSynthConfig()
  }

  private getDefaultSynthConfig(): SynthConfiguration {
    return {
      oscillatorType: 'triangle',
      oscillatorDetune: 0,
      filterType: 'lowpass',
      filterFrequency: 2000,
      filterQ: 1,
      lfoEnabled: false,
      lfoFrequency: 4,
      lfoDepth: 0.1,
      lfoTarget: 'pitch',
      delayEnabled: false,
      delayTime: 0.15,
      delayFeedback: 0.3,
      envelopeAttack: 0.01,
      envelopeDecay: 0.15,
      envelopeSustain: 0.2,
      envelopeRelease: 0.2,
    }
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  private isUnlockListenerAttached: boolean = false

  init(): void {
    if (this.audioContext) {
      console.log('[SoundEngine] Already initialized, state:', this.audioContext.state)
      return
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = this.config.masterVolume
      this.masterGain.connect(this.audioContext.destination)
      console.log('[SoundEngine] Initialized, state:', this.audioContext.state, 'volume:', this.config.masterVolume)

      // Set up iOS/Safari unlock listeners
      this.setupUnlockListeners()
    } catch (e) {
      console.warn('[SoundEngine] Web Audio API not supported:', e)
    }
  }

  /**
   * Set up event listeners to unlock AudioContext on user interaction.
   * This is required for iOS Safari and other browsers that suspend AudioContext.
   */
  private setupUnlockListeners(): void {
    if (this.isUnlockListenerAttached || typeof document === 'undefined') return
    if (!this.audioContext) return

    const events = ['touchstart', 'touchend', 'mousedown', 'keydown']

    const unlock = () => {
      console.log('[SoundEngine] Unlock triggered by user interaction')
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('[SoundEngine] AudioContext resumed successfully, state:', this.audioContext?.state)
        }).catch(err => {
          console.warn('[SoundEngine] Failed to resume AudioContext:', err)
        })
      }

      // Only remove listeners after context is running
      if (this.audioContext?.state === 'running') {
        console.log('[SoundEngine] Removing unlock listeners')
        events.forEach(e => document.body.removeEventListener(e, unlock, false))
      }
    }

    events.forEach(e => document.body.addEventListener(e, unlock, false))
    this.isUnlockListenerAttached = true
    console.log('[SoundEngine] Unlock listeners attached')
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      console.log('[SoundEngine] Resuming suspended AudioContext...')
      await this.audioContext.resume()
      console.log('[SoundEngine] Resumed, new state:', this.audioContext.state)
    }
  }

  /**
   * Force unlock for iOS - call this directly in a touch/click handler.
   * Note: On iOS, if the physical silent/mute switch is ON, no Web Audio will play.
   */
  unlockAudio(): void {
    console.log('[SoundEngine] unlockAudio called, current state:', this.audioContext?.state)

    // Create context if needed
    if (!this.audioContext) {
      this.init()
    }

    // Resume if suspended
    if (this.audioContext?.state === 'suspended') {
      console.log('[SoundEngine] Calling resume() on suspended context')
      this.audioContext.resume().then(() => {
        console.log('[SoundEngine] Resume complete, state:', this.audioContext?.state)
      })
    }
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  setEnabled(enabled: boolean): void {
    console.log('[SoundEngine] setEnabled:', enabled)
    this.config.enabled = enabled
  }

  setVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.masterVolume
    }
  }

  setMuted(muted: boolean): void {
    this.config.muted = muted
  }

  isEnabled(): boolean {
    return this.config.enabled && !this.config.muted
  }

  setProgressiveMode(enabled: boolean): void {
    this.config.progressiveMode = enabled
    if (enabled) {
      this.resetConfiguration()
    }
  }

  setConfigurationPhaseCount(count: number): void {
    this.config.configurationPhaseCount = Math.max(1, count)
  }

  resetConfiguration(): void {
    this.eventCount = 0
    this.isConfigured = false
    this.synthConfig = this.getDefaultSynthConfig()
    this.configurationLog = []
  }

  getConfigurationLog(): string[] {
    return [...this.configurationLog]
  }

  isInConfigurationPhase(): boolean {
    return this.config.progressiveMode && !this.isConfigured
  }

  getConfiguredSynth(): SynthConfiguration {
    return { ...this.synthConfig }
  }

  /**
   * Set synth configuration (partial update)
   */
  setSynthConfig(config: Partial<SynthConfiguration>): void {
    this.synthConfig = { ...this.synthConfig, ...config }
  }

  /**
   * Set a single synth parameter
   */
  setSynthParam<K extends keyof SynthConfiguration>(
    key: K,
    value: SynthConfiguration[K]
  ): void {
    this.synthConfig[key] = value
  }

  /**
   * Play a test note with the current configured synth
   */
  playTestNote(noteName: string = 'E4'): void {
    // For test notes, temporarily enable if needed
    const wasEnabled = this.config.enabled
    if (!wasEnabled) {
      this.config.enabled = true
    }

    // iOS: All audio operations must happen synchronously during user gesture
    // Don't use .then() - just call everything directly
    this.init()
    this.resume() // Don't await - just kick off the resume

    const frequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
    const patch = this.buildPatchFromConfig()
    this.playSynthNote(frequency, patch)

    // Restore enabled state after a brief delay (after sound has started)
    if (!wasEnabled) {
      setTimeout(() => {
        this.config.enabled = false
      }, 100)
    }
  }

  /**
   * Play a test sequence to demo the current synth
   */
  playTestSequence(): void {
    const notes = ['C4', 'E4', 'G4', 'A4', 'C5']
    notes.forEach((note, i) => {
      setTimeout(() => this.playTestNote(note), i * 200)
    })
  }

  /**
   * Get available options for synth parameters (for UI dropdowns)
   */
  static getOscillatorTypes(): OscillatorType[] {
    return OSCILLATOR_TYPES
  }

  static getFilterTypes(): BiquadFilterType[] {
    return FILTER_TYPES
  }

  static getScaleNotes(): string[] {
    return Object.keys(SCALE_FREQUENCIES)
  }

  // ===========================================================================
  // SOUND PLAYBACK
  // ===========================================================================

  /**
   * Play a synthesized sound for a category
   * @param category The event category
   * @param toolName Optional tool name for tool-specific note selection
   */
  playForCategory(category: string, toolName?: string): void {
    console.log('[SoundEngine] playForCategory:', category, 'tool:', toolName, 'enabled:', this.config.enabled, 'muted:', this.config.muted, 'audioContext:', this.audioContext?.state)

    if (!this.isEnabled()) {
      console.log('[SoundEngine] Sound disabled, skipping')
      return
    }

    // Rate limiting
    const now = performance.now()
    if (now - this.lastPlayTime < this.minInterval) {
      console.log('[SoundEngine] Rate limited, skipping')
      return
    }
    this.lastPlayTime = now

    this.eventCount++

    // Progressive mode handling
    if (this.config.progressiveMode) {
      if (!this.isConfigured) {
        // Configuration phase - play stock sound while configuring
        this.configureFromCategory(category)
        this.playStockSound(category)

        // Check if configuration is complete
        if (this.eventCount >= this.config.configurationPhaseCount) {
          this.isConfigured = true
        }
        return
      }

      // Post-configuration - play notes with configured synth
      // Use tool-specific note if available, otherwise category note
      const noteName = (toolName && TOOL_NOTES[toolName]) || CATEGORY_NOTES[category] || CATEGORY_NOTES.default
      const frequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
      const patch = this.buildPatchFromConfig()
      this.playSynthNote(frequency, patch)
      return
    }

    // Standard mode - use user-configured synth if available, otherwise preset patches
    // Use tool-specific note if available, otherwise category note
    const noteName = (toolName && TOOL_NOTES[toolName]) || CATEGORY_NOTES[category] || CATEGORY_NOTES.default
    const frequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4

    // Use user's configured synth settings instead of hardcoded patches
    // This allows the synth panel to affect the actual playback
    const patch = this.buildPatchFromConfig()

    this.playSynthNote(frequency, patch)
  }

  /**
   * Configure a synth parameter based on category
   */
  private configureFromCategory(category: string): void {
    const param = CONFIGURATION_MAPPINGS[category] || CONFIGURATION_MAPPINGS['default']
    if (!param) return

    // Determine value based on event count (for variety)
    const seed = this.eventCount

    switch (param) {
      case 'oscillatorType':
        this.synthConfig.oscillatorType = OSCILLATOR_TYPES[seed % OSCILLATOR_TYPES.length]
        this.configurationLog.push(`Oscillator: ${this.synthConfig.oscillatorType}`)
        break
      case 'filterType':
        this.synthConfig.filterType = FILTER_TYPES[seed % FILTER_TYPES.length]
        this.configurationLog.push(`Filter: ${this.synthConfig.filterType}`)
        break
      case 'filterFrequency':
        this.synthConfig.filterFrequency = 500 + (seed % 5) * 500 // 500-2500 Hz
        this.configurationLog.push(`Filter freq: ${this.synthConfig.filterFrequency}Hz`)
        break
      case 'filterQ':
        this.synthConfig.filterQ = 1 + (seed % 8) // 1-8
        this.configurationLog.push(`Filter Q: ${this.synthConfig.filterQ}`)
        break
      case 'lfoEnabled':
        this.synthConfig.lfoEnabled = seed % 2 === 0
        this.configurationLog.push(`LFO: ${this.synthConfig.lfoEnabled ? 'on' : 'off'}`)
        break
      case 'lfoFrequency':
        this.synthConfig.lfoFrequency = 1 + (seed % 8) // 1-8 Hz
        this.configurationLog.push(`LFO freq: ${this.synthConfig.lfoFrequency}Hz`)
        break
      case 'lfoDepth':
        this.synthConfig.lfoDepth = 0.05 + (seed % 5) * 0.05 // 0.05-0.25
        this.configurationLog.push(`LFO depth: ${this.synthConfig.lfoDepth}`)
        break
      case 'delayEnabled':
        this.synthConfig.delayEnabled = seed % 2 === 1
        this.configurationLog.push(`Delay: ${this.synthConfig.delayEnabled ? 'on' : 'off'}`)
        break
      case 'oscillatorDetune':
        this.synthConfig.oscillatorDetune = (seed % 10) - 5 // -5 to 5 cents
        this.configurationLog.push(`Detune: ${this.synthConfig.oscillatorDetune}`)
        break
      case 'envelopeDecay':
        this.synthConfig.envelopeDecay = 0.05 + (seed % 5) * 0.05 // 0.05-0.25
        this.configurationLog.push(`Decay: ${this.synthConfig.envelopeDecay}s`)
        break
      case 'envelopeSustain':
        this.synthConfig.envelopeSustain = 0.1 + (seed % 4) * 0.15 // 0.1-0.55
        this.configurationLog.push(`Sustain: ${this.synthConfig.envelopeSustain}`)
        break
      case 'envelopeRelease':
        this.synthConfig.envelopeRelease = 0.1 + (seed % 4) * 0.1 // 0.1-0.4
        this.configurationLog.push(`Release: ${this.synthConfig.envelopeRelease}s`)
        break
    }
  }

  /**
   * Play a stock sound (for configuration phase)
   */
  private playStockSound(category: string): void {
    const stockNames = Object.keys(STOCK_SOUNDS)
    const stockName = stockNames[this.eventCount % stockNames.length]
    const patch = STOCK_SOUNDS[stockName]

    // Use higher pitch for configuration sounds to indicate "building"
    const configNotes = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6']
    const noteName = configNotes[this.eventCount % configNotes.length]
    const frequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.C5

    this.playSynthNote(frequency, patch)
  }

  /**
   * Build a SynthPatch from the configured parameters
   */
  private buildPatchFromConfig(): SynthPatch {
    const patch: SynthPatch = {
      oscillators: [
        { type: this.synthConfig.oscillatorType, detune: 0, volume: 0.5 },
        { type: this.synthConfig.oscillatorType, detune: this.synthConfig.oscillatorDetune, volume: 0.3 },
      ],
      envelope: {
        attack: this.synthConfig.envelopeAttack,
        decay: this.synthConfig.envelopeDecay,
        sustain: this.synthConfig.envelopeSustain,
        release: this.synthConfig.envelopeRelease,
      },
      filter: {
        type: this.synthConfig.filterType,
        frequency: this.synthConfig.filterFrequency,
        Q: this.synthConfig.filterQ,
      },
    }

    if (this.synthConfig.lfoEnabled) {
      patch.lfo = {
        frequency: this.synthConfig.lfoFrequency,
        depth: this.synthConfig.lfoDepth,
        target: this.synthConfig.lfoTarget,
        waveform: 'sine',
      }
    }

    if (this.synthConfig.delayEnabled) {
      patch.delay = {
        time: this.synthConfig.delayTime,
        feedback: this.synthConfig.delayFeedback,
        mix: 0.25,
      }
    }

    return patch
  }

  /**
   * Play a specific sound type
   */
  play(type: SoundType): void {
    console.log('[SoundEngine] play:', type, 'enabled:', this.config.enabled, 'muted:', this.config.muted)
    if (!this.isEnabled()) {
      console.log('[SoundEngine] play: skipping, isEnabled returned false')
      return
    }

    const categoryMap: Record<SoundType, string> = {
      place: 'default',
      snap: 'execute',
      complete: 'complete',
      error: 'error',
      input: 'input',
      waiting: 'wait',
      success: 'success',
    }

    this.playForCategory(categoryMap[type])
  }

  // ===========================================================================
  // SYNTH ENGINE
  // ===========================================================================

  private playSynthNote(frequency: number, patch: SynthPatch): void {
    if (!this.audioContext || !this.masterGain) {
      this.init()
    }
    if (!this.audioContext || !this.masterGain) {
      console.warn('[SoundEngine] playSynthNote: No audio context or master gain')
      return
    }

    // Try to resume if suspended (belt-and-suspenders for iOS)
    // This won't work outside a user gesture but doesn't hurt to try
    if (this.audioContext.state === 'suspended') {
      console.log('[SoundEngine] playSynthNote: Context suspended, attempting resume')
      this.audioContext.resume()
    }

    const ctx = this.audioContext
    const now = ctx.currentTime

    console.log('[SoundEngine] playSynthNote: freq=', frequency, 'state=', ctx.state, 'masterGain=', this.masterGain.gain.value)

    // Create nodes
    const oscillators: OscillatorNode[] = []
    const oscGains: GainNode[] = []

    // Output chain
    let outputNode: AudioNode = this.masterGain

    // Add delay if configured
    let delayNode: DelayNode | null = null
    let delayFeedback: GainNode | null = null
    let delayMix: GainNode | null = null
    let dryGain: GainNode | null = null

    if (patch.delay) {
      delayNode = ctx.createDelay(1)
      delayNode.delayTime.value = patch.delay.time

      delayFeedback = ctx.createGain()
      delayFeedback.gain.value = patch.delay.feedback

      delayMix = ctx.createGain()
      delayMix.gain.value = patch.delay.mix

      dryGain = ctx.createGain()
      dryGain.gain.value = 1 - patch.delay.mix

      // Delay feedback loop
      delayNode.connect(delayFeedback)
      delayFeedback.connect(delayNode)

      // Mix wet and dry
      delayNode.connect(delayMix)
      delayMix.connect(this.masterGain)
      dryGain.connect(this.masterGain)

      outputNode = dryGain
    }

    // Add filter if configured
    let filterNode: BiquadFilterNode | null = null
    if (patch.filter) {
      filterNode = ctx.createBiquadFilter()
      filterNode.type = patch.filter.type
      filterNode.frequency.value = patch.filter.frequency
      filterNode.Q.value = patch.filter.Q
      filterNode.connect(outputNode)
      if (delayNode && dryGain) {
        filterNode.connect(delayNode)
      }
      outputNode = filterNode
    }

    // Envelope gain
    const envelopeGain = ctx.createGain()
    envelopeGain.gain.setValueAtTime(0, now)
    envelopeGain.connect(outputNode)

    // Apply ADSR envelope
    const { attack, decay, sustain, release } = patch.envelope
    // Sustain hold time scales with envelope settings for longer notes
    // This is how long the note sustains at the sustain level before release
    const sustainHold = Math.max(0.15, decay * 0.8 + release * 0.5)
    const totalDuration = attack + decay + sustainHold + release

    envelopeGain.gain.linearRampToValueAtTime(1, now + attack)
    envelopeGain.gain.linearRampToValueAtTime(sustain, now + attack + decay)
    envelopeGain.gain.setValueAtTime(sustain, now + attack + decay + 0.1)
    envelopeGain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration)

    // LFO setup
    let lfoNode: OscillatorNode | null = null
    let lfoGain: GainNode | null = null

    if (patch.lfo) {
      lfoNode = ctx.createOscillator()
      lfoNode.type = patch.lfo.waveform
      lfoNode.frequency.value = patch.lfo.frequency

      lfoGain = ctx.createGain()

      if (patch.lfo.target === 'pitch') {
        // Modulate pitch (in cents)
        lfoGain.gain.value = patch.lfo.depth * 100
      } else if (patch.lfo.target === 'amplitude') {
        lfoGain.gain.value = patch.lfo.depth
      } else if (patch.lfo.target === 'filter' && filterNode) {
        lfoGain.gain.value = patch.lfo.depth * 1000
        lfoNode.connect(lfoGain)
        lfoGain.connect(filterNode.frequency)
      }

      lfoNode.connect(lfoGain)
      lfoNode.start(now)
      lfoNode.stop(now + totalDuration + 0.1)
    }

    // Create oscillators
    for (const oscConfig of patch.oscillators) {
      const osc = ctx.createOscillator()
      osc.type = oscConfig.type
      osc.frequency.value = frequency
      osc.detune.value = oscConfig.detune

      // Connect LFO to pitch if configured
      if (lfoGain && patch.lfo?.target === 'pitch') {
        lfoGain.connect(osc.detune)
      }

      const oscGain = ctx.createGain()
      oscGain.gain.value = oscConfig.volume

      // Connect LFO to amplitude if configured
      if (lfoGain && patch.lfo?.target === 'amplitude') {
        lfoGain.connect(oscGain.gain)
      }

      osc.connect(oscGain)
      oscGain.connect(envelopeGain)

      oscillators.push(osc)
      oscGains.push(oscGain)

      osc.start(now)
      osc.stop(now + totalDuration + 0.2)
    }

    console.log('[SoundEngine] Oscillators started:', oscillators.length, 'frequency:', frequency, 'duration:', totalDuration)
  }

  /**
   * Play a celebratory arpeggio
   */
  playArpeggio(): void {
    if (!this.isEnabled()) return

    const notes = ['C4', 'E4', 'G4', 'C5', 'E5']
    const delay = 80 // ms between notes

    notes.forEach((note, i) => {
      setTimeout(() => {
        const freq = SCALE_FREQUENCIES[note]
        this.playSynthNote(freq, PATCHES.success)
      }, i * delay)
    })
  }

  /**
   * Play completion fanfare
   */
  playCompletion(): void {
    if (!this.isEnabled()) return

    // Play a chord, then arpeggio
    const chord = ['C4', 'E4', 'G4']
    chord.forEach((note, i) => {
      setTimeout(() => {
        const freq = SCALE_FREQUENCIES[note]
        this.playSynthNote(freq, PATCHES.complete)
      }, i * 30)
    })

    // Then arpeggio
    setTimeout(() => this.playArpeggio(), 300)
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
      this.masterGain = null
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let soundEngineInstance: SoundEngine | null = null

export function getSoundEngine(): SoundEngine {
  if (!soundEngineInstance) {
    soundEngineInstance = new SoundEngine()
  }
  return soundEngineInstance
}

export function disposeSoundEngine(): void {
  if (soundEngineInstance) {
    soundEngineInstance.dispose()
    soundEngineInstance = null
  }
}
