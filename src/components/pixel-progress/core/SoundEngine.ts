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

export type SoundMode = 'realtime' | 'on-complete'

export interface SoundEngineConfig {
  enabled: boolean
  masterVolume: number // 0-1
  muted: boolean
  /** Enable progressive configuration mode */
  progressiveMode: boolean
  /** Number of events in the configuration phase */
  configurationPhaseCount: number
  /** Sound playback mode: 'realtime' plays as events come, 'on-complete' buffers and plays when block ends */
  soundMode: SoundMode
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
  // Scale settings
  scaleType: ScaleType
  scaleRoot: RootNote
  // Octave shift: 0 = normal, positive = higher, negative = lower
  octaveShift: number
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

// Available musical scales - each defines notes relative to root
export type ScaleType = 'major' | 'minor' | 'pentatonic' | 'blues' | 'dorian' | 'mixolydian' | 'chromatic'

const SCALE_TYPES: ScaleType[] = ['major', 'minor', 'pentatonic', 'blues', 'dorian', 'mixolydian', 'chromatic']

// Scale intervals (semitones from root)
const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],           // C D E F G A B
  minor: [0, 2, 3, 5, 7, 8, 10],           // C D Eb F G Ab Bb
  pentatonic: [0, 2, 4, 7, 9],             // C D E G A (major pentatonic)
  blues: [0, 3, 5, 6, 7, 10],              // C Eb F F# G Bb
  dorian: [0, 2, 3, 5, 7, 9, 10],          // C D Eb F G A Bb
  mixolydian: [0, 2, 4, 5, 7, 9, 10],      // C D E F G A Bb
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // All notes
}

// Root notes
export type RootNote = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

const ROOT_NOTES: RootNote[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
}

// Get notes in a scale starting from a root
function getScaleNotes(root: RootNote, scaleType: ScaleType, octaveStart: number = 3, octaveEnd: number = 5): string[] {
  const intervals = SCALE_INTERVALS[scaleType]
  const rootSemitone = NOTE_TO_SEMITONE[root]
  const notes: string[] = []

  for (let octave = octaveStart; octave <= octaveEnd; octave++) {
    for (const interval of intervals) {
      const semitone = (rootSemitone + interval) % 12
      const noteOctave = octave + Math.floor((rootSemitone + interval) / 12)
      if (noteOctave > octaveEnd) continue

      const noteName = ROOT_NOTES[semitone]
      const fullNote = `${noteName}${noteOctave}`
      if (SCALE_FREQUENCIES[fullNote]) {
        notes.push(fullNote)
      }
    }
  }

  return notes
}

// Map categories to scale degrees (0-based index into scale)
const CATEGORY_SCALE_DEGREES: Record<string, number> = {
  start: 0,      // Root
  create: 2,     // 3rd
  modify: 1,     // 2nd
  execute: 4,    // 5th
  search: 3,     // 4th
  analyze: 5,    // 6th
  process: 1,    // 2nd (lower octave handled separately)
  input: 6,      // 7th
  wait: 0,       // Root (lower)
  success: 7,    // Octave
  error: 0,      // Root (very low)
  end: 5,        // 6th (higher)
  optimize: 0,   // Root (lowest)
  default: 4,    // 5th
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

const STORAGE_KEY = 'llmwhiteboard-sound-settings'

interface StoredSoundSettings {
  config: Partial<SoundEngineConfig>
  synthConfig: SynthConfiguration
}

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

  // Note history for attention sequence on wait states (just last few notes for short-term memory)
  private recentNotes: string[] = []
  private readonly MAX_NOTE_HISTORY = 3

  // Track categories for replay functionality (stored as categories, not scale indices)
  private lastPlayedCategories: string[] = []
  private currentCategories: string[] = []

  constructor(config: Partial<SoundEngineConfig> = {}) {
    // Load saved settings from localStorage
    const savedSettings = this.loadFromStorage()

    this.config = {
      enabled: true,
      masterVolume: 0.3,
      muted: false,
      progressiveMode: false,
      configurationPhaseCount: 5,
      soundMode: 'on-complete', // Default to on-complete mode
      ...savedSettings?.config,
      ...config,
    }

    // Initialize synth configuration from saved or defaults
    this.synthConfig = savedSettings?.synthConfig || this.getDefaultSynthConfig()
  }

  /**
   * Load settings from localStorage
   */
  private loadFromStorage(): StoredSoundSettings | null {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as StoredSoundSettings
        console.log('[SoundEngine] Loaded settings from localStorage')
        return parsed
      }
    } catch (e) {
      console.warn('[SoundEngine] Failed to load settings from localStorage:', e)
    }
    return null
  }

  /**
   * Save settings to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return
    try {
      const settings: StoredSoundSettings = {
        config: {
          masterVolume: this.config.masterVolume,
          soundMode: this.config.soundMode,
          progressiveMode: this.config.progressiveMode,
        },
        synthConfig: this.synthConfig,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      console.log('[SoundEngine] Saved settings to localStorage')
    } catch (e) {
      console.warn('[SoundEngine] Failed to save settings to localStorage:', e)
    }
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
      scaleType: 'pentatonic',
      scaleRoot: 'C',
      octaveShift: 0,
    }
  }

  /**
   * Get a note from the current scale for a category
   * Returns both the note name and the scale index for buffering
   */
  private getNoteForCategory(category: string, toolName?: string): { note: string, scaleIndex: number } {
    // Get the scale notes
    const scaleNotes = getScaleNotes(this.synthConfig.scaleRoot, this.synthConfig.scaleType, 3, 5)

    if (scaleNotes.length === 0) {
      // Fallback to hardcoded notes
      const fallbackNote = (toolName && TOOL_NOTES[toolName]) || CATEGORY_NOTES[category] || CATEGORY_NOTES.default
      return { note: fallbackNote, scaleIndex: 0 }
    }

    // Get scale degree for this category
    const degree = CATEGORY_SCALE_DEGREES[category] ?? CATEGORY_SCALE_DEGREES.default

    // Map degree to scale note (with wrapping for octaves)
    const noteIndex = degree % scaleNotes.length
    return { note: scaleNotes[noteIndex] || scaleNotes[0], scaleIndex: noteIndex }
  }

  /**
   * Get frequency for a scale index with current scale settings and octave shift applied
   */
  private getFrequencyForScaleIndex(scaleIndex: number): number {
    const scaleNotes = getScaleNotes(this.synthConfig.scaleRoot, this.synthConfig.scaleType, 3, 5)

    if (scaleNotes.length === 0) {
      return SCALE_FREQUENCIES.E4
    }

    const noteName = scaleNotes[scaleIndex % scaleNotes.length] || scaleNotes[0]
    const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4

    // Apply octave shift (each octave doubles/halves the frequency)
    // Default to 0 if octaveShift is undefined (for backwards compatibility with stored settings)
    const octaveShift = this.synthConfig.octaveShift ?? 0
    return baseFrequency * Math.pow(2, octaveShift)
  }

  // Static methods for UI
  static getScaleTypes(): ScaleType[] {
    return [...SCALE_TYPES]
  }

  static getRootNotes(): RootNote[] {
    return [...ROOT_NOTES]
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
    this.saveToStorage()
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
    this.saveToStorage()
  }

  setConfigurationPhaseCount(count: number): void {
    this.config.configurationPhaseCount = Math.max(1, count)
  }

  setSoundMode(mode: SoundMode): void {
    console.log('[SoundEngine] setSoundMode:', mode)
    this.config.soundMode = mode
    this.saveToStorage()
  }

  getSoundMode(): SoundMode {
    return this.config.soundMode
  }

  resetConfiguration(): void {
    this.eventCount = 0
    this.isConfigured = false
    this.synthConfig = this.getDefaultSynthConfig()
    this.configurationLog = []
    this.saveToStorage()
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
    this.saveToStorage()
  }

  /**
   * Set a single synth parameter
   */
  setSynthParam<K extends keyof SynthConfiguration>(
    key: K,
    value: SynthConfiguration[K]
  ): void {
    this.synthConfig[key] = value
    this.saveToStorage()
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

    const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
    const octaveShift = this.synthConfig.octaveShift ?? 0
    const frequency = baseFrequency * Math.pow(2, octaveShift)
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
   * Play a single note for a category (realtime mode)
   * @param category The event category
   * @param toolName Optional tool name for tool-specific note selection
   */
  playForCategory(category: string, toolName?: string): void {
    console.log('[SoundEngine] playForCategory:', category, 'tool:', toolName)

    if (!this.isEnabled()) {
      return
    }

    // Rate limiting
    const now = performance.now()
    if (now - this.lastPlayTime < this.minInterval) {
      return
    }
    this.lastPlayTime = now

    this.eventCount++

    // Progressive mode handling
    if (this.config.progressiveMode) {
      if (!this.isConfigured) {
        this.configureFromCategory(category)
        this.playStockSound(category)
        if (this.eventCount >= this.config.configurationPhaseCount) {
          this.isConfigured = true
        }
        return
      }
    }

    // Get note for category
    const { note: noteName } = this.getNoteForCategory(category, toolName)
    const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
    const octaveShift = this.synthConfig.octaveShift ?? 0
    const frequency = baseFrequency * Math.pow(2, octaveShift)
    const patch = this.buildPatchFromConfig()

    // Track note for attention sequence
    this.addToNoteHistory(noteName)

    // Check if this is a wait/input state that needs attention
    const isAttentionNeeded = category === 'wait' || category === 'input'
    if (isAttentionNeeded && this.config.soundMode === 'realtime') {
      this.playAttentionSequence(noteName, patch)
      return
    }

    this.playSynthNote(frequency, patch)
  }

  /**
   * Play a sequence of categories
   * @param categories Array of category strings to play
   * @param options Options for playback
   */
  playSequence(categories: string[], options?: { times?: number, onComplete?: () => void }): void {
    if (!this.isEnabled()) {
      console.log('[SoundEngine] playSequence: sound disabled, skipping')
      return
    }

    if (categories.length === 0) {
      console.log('[SoundEngine] No categories to play')
      return
    }

    // Ensure audio context is ready
    this.init()

    // Store for replay
    this.lastPlayedCategories = [...categories]

    const times = options?.times ?? 1
    console.log('[SoundEngine] Playing sequence:', categories.length, 'notes,', times, 'time(s)')

    const patch = this.buildPatchFromConfig()

    // Calculate timing - faster for longer sequences
    const baseDelay = categories.length > 20 ? 50 :
                      categories.length > 10 ? 70 : 90
    const sequenceDuration = categories.length * baseDelay
    const pauseBetween = 200

    for (let t = 0; t < times; t++) {
      const repeatOffset = t * (sequenceDuration + pauseBetween)

      categories.forEach((category, index) => {
        setTimeout(() => {
          const { note: noteName } = this.getNoteForCategory(category)
          const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
          const octaveShift = this.synthConfig.octaveShift ?? 0
          const frequency = baseFrequency * Math.pow(2, octaveShift)
          this.playSynthNote(frequency, patch)
        }, repeatOffset + index * baseDelay)
      })
    }

    // Call onComplete after all notes are scheduled
    if (options?.onComplete) {
      const totalDuration = times * (sequenceDuration + pauseBetween)
      setTimeout(options.onComplete, totalDuration)
    }
  }

  /**
   * Sync current categories from the component (for preview functionality)
   */
  setCurrentCategories(categories: string[]): void {
    this.currentCategories = [...categories]
  }

  /**
   * Get the current categories count
   */
  getCurrentCategoriesCount(): number {
    return this.currentCategories.length
  }

  /**
   * Get the last played sequence count
   */
  getLastSequenceCount(): number {
    return this.lastPlayedCategories.length
  }

  /**
   * Replay the last played sequence
   */
  replayLastSequence(): void {
    if (!this.isEnabled()) return
    if (this.lastPlayedCategories.length === 0) {
      console.log('[SoundEngine] No sequence to replay')
      return
    }
    this.init()
    console.log('[SoundEngine] Replaying last sequence:', this.lastPlayedCategories.length, 'notes')
    const categories = this.lastPlayedCategories
    const patch = this.buildPatchFromConfig()
    const baseDelay = categories.length > 20 ? 50 : categories.length > 10 ? 70 : 90

    categories.forEach((category, index) => {
      setTimeout(() => {
        const { note: noteName } = this.getNoteForCategory(category)
        const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
        const octaveShift = this.synthConfig.octaveShift ?? 0
        const frequency = baseFrequency * Math.pow(2, octaveShift)
        this.playSynthNote(frequency, patch)
      }, index * baseDelay)
    })
  }

  /**
   * Preview the current buffer (categories being collected)
   */
  playCurrentBuffer(): void {
    if (!this.isEnabled()) return
    if (this.currentCategories.length === 0) {
      console.log('[SoundEngine] No categories in current buffer')
      return
    }
    this.init()
    console.log('[SoundEngine] Playing current buffer:', this.currentCategories.length, 'notes')
    const categories = this.currentCategories
    const patch = this.buildPatchFromConfig()
    const baseDelay = categories.length > 20 ? 50 : categories.length > 10 ? 70 : 90

    categories.forEach((category, index) => {
      setTimeout(() => {
        const { note: noteName } = this.getNoteForCategory(category)
        const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
        const octaveShift = this.synthConfig.octaveShift ?? 0
        const frequency = baseFrequency * Math.pow(2, octaveShift)
        this.playSynthNote(frequency, patch)
      }, index * baseDelay)
    })
  }

  /**
   * Play compaction sound - chord collapse effect
   * Plays the given categories as a chord, then resolves to a low root note
   * @param categories Categories to use for the chord (uses last 5 if more provided)
   */
  playCompactionSound(categories?: string[]): void {
    if (!this.isEnabled()) {
      console.log('[SoundEngine] playCompactionSound: sound disabled, skipping')
      return
    }
    this.init()
    console.log('[SoundEngine] Playing compaction chord collapse, categories:', categories?.length ?? 0)

    const patch = this.buildPatchFromConfig()

    // Get categories for the chord (last 5, or default chord)
    const chordCategories = categories && categories.length > 0
      ? categories.slice(-5)
      : ['start', 'create', 'execute'] // Default chord

    // Play all chord notes simultaneously with slight stagger for richness
    chordCategories.forEach((category, i) => {
      setTimeout(() => {
        const { note: noteName } = this.getNoteForCategory(category)
        const baseFrequency = SCALE_FREQUENCIES[noteName] ?? SCALE_FREQUENCIES.E4
        const octaveShift = this.synthConfig.octaveShift ?? 0
        const frequency = baseFrequency * Math.pow(2, octaveShift)
        this.playSynthNote(frequency, patch)
      }, i * 15) // 15ms stagger for a "strummed" feel
    })

    // After the chord, resolve to a low root note
    const chordDuration = chordCategories.length * 15 + 200
    setTimeout(() => {
      const scaleNotes = getScaleNotes(this.synthConfig.scaleRoot, this.synthConfig.scaleType, 3, 5)
      const rootNote = scaleNotes[0] || 'C3'
      const baseFrequency = SCALE_FREQUENCIES[rootNote] ?? SCALE_FREQUENCIES.C3
      const octaveShift = (this.synthConfig.octaveShift ?? 0) - 1
      const lowFrequency = baseFrequency * Math.pow(2, octaveShift)
      this.playSynthNote(lowFrequency, patch)
    }, chordDuration)

    // Play an even lower "thunk" for extra impact
    setTimeout(() => {
      const scaleNotes = getScaleNotes(this.synthConfig.scaleRoot, this.synthConfig.scaleType, 3, 5)
      const rootNote = scaleNotes[0] || 'C3'
      const baseFrequency = SCALE_FREQUENCIES[rootNote] ?? SCALE_FREQUENCIES.C3
      const octaveShift = (this.synthConfig.octaveShift ?? 0) - 2
      const veryLowFrequency = baseFrequency * Math.pow(2, octaveShift)
      this.playSynthNote(veryLowFrequency, patch)
    }, chordDuration + 150)
  }

  /**
   * Add a note to the recent history
   */
  private addToNoteHistory(noteName: string): void {
    this.recentNotes.push(noteName)
    if (this.recentNotes.length > this.MAX_NOTE_HISTORY) {
      this.recentNotes.shift()
    }
  }

  /**
   * Play an attention-grabbing sequence when waiting for user input
   * Pattern: current note, then last 3 notes twice (total 7 notes)
   */
  private playAttentionSequence(currentNote: string, patch: SynthPatch): void {
    const currentFreq = SCALE_FREQUENCIES[currentNote] ?? SCALE_FREQUENCIES.E4

    // Build the sequence: current, then (n-2, n-1, current) x 2
    const sequence: number[] = [currentFreq]

    // Get the last 3 notes (pad with current if not enough history)
    const last3: string[] = []
    for (let i = 0; i < 3; i++) {
      const historyIndex = this.recentNotes.length - 3 + i
      if (historyIndex >= 0 && historyIndex < this.recentNotes.length) {
        last3.push(this.recentNotes[historyIndex])
      } else {
        last3.push(currentNote)
      }
    }

    // Add the 3-note pattern twice
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const note of last3) {
        sequence.push(SCALE_FREQUENCIES[note] ?? SCALE_FREQUENCIES.E4)
      }
    }

    // Play the sequence with timing
    const noteDelay = 120 // ms between notes
    sequence.forEach((freq, index) => {
      setTimeout(() => {
        this.playSynthNote(freq, patch)
      }, index * noteDelay)
    })

    console.log('[SoundEngine] Playing attention sequence:', sequence.length, 'notes')
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
