"use client"

/**
 * SynthControlPanel
 *
 * A reusable synth control panel for tweaking sound parameters.
 * Modern UI design (not pixel art) - can be used for any synth-related features.
 * Settings take effect immediately when changed.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SoundEngine, getSoundEngine, type SynthConfiguration, type SoundMode, type ScaleType, type RootNote } from '@/components/pixel-progress/core/SoundEngine'
import { X } from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

export type VisualTheme = 'lego' | 'painter' | 'garden'

const THEME_OPTIONS: { value: VisualTheme; label: string; description: string }[] = [
  { value: 'lego', label: 'Lego', description: 'Colorful building blocks' },
  { value: 'painter', label: 'Painter', description: 'Artistic brush strokes' },
  { value: 'garden', label: 'Garden', description: 'Growing plants and flowers' },
]

export interface SynthControlPanelProps {
  /** Callback when settings change */
  onSettingsChange?: (config: SynthConfiguration) => void
  /** Callback to replay with new settings */
  onReplay?: () => void
  /** Whether the panel is open */
  open?: boolean
  /** Callback when panel open state changes */
  onOpenChange?: (open: boolean) => void
  /** Current visual theme */
  visualTheme?: VisualTheme
  /** Callback when visual theme changes */
  onVisualThemeChange?: (theme: VisualTheme) => void
}

// =============================================================================
// SLIDER COMPONENT
// =============================================================================

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, unit = '', onChange }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="text-foreground font-mono">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  )
}

// =============================================================================
// TOGGLE COMPONENT
// =============================================================================

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${checked ? 'bg-primary' : 'bg-secondary'}
        `}
      >
        <span
          className={`
            inline-block h-3 w-3 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-1'}
          `}
        />
      </button>
    </label>
  )
}

// =============================================================================
// MINI KEYBOARD COMPONENT
// =============================================================================

// Full keyboard layout - white keys with their corresponding black keys
const KEYBOARD_LAYOUT = [
  { white: 'C3', black: null },
  { white: 'D3', black: 'C#3' },
  { white: 'E3', black: 'D#3' },
  { white: 'F3', black: null },
  { white: 'G3', black: 'F#3' },
  { white: 'A3', black: 'G#3' },
  { white: 'B3', black: 'A#3' },
  { white: 'C4', black: null },
  { white: 'D4', black: 'C#4' },
  { white: 'E4', black: 'D#4' },
  { white: 'F4', black: null },
  { white: 'G4', black: 'F#4' },
  { white: 'A4', black: 'G#4' },
  { white: 'B4', black: 'A#4' },
  { white: 'C5', black: null },
  { white: 'D5', black: 'C#5' },
  { white: 'E5', black: 'D#5' },
  { white: 'F5', black: null },
  { white: 'G5', black: 'F#5' },
  { white: 'A5', black: 'G#5' },
  { white: 'B5', black: 'A#5' },
  { white: 'C6', black: null },
]

function MiniKeyboard() {
  const playNote = useCallback((noteName: string) => {
    const soundEngine = getSoundEngine()
    // iOS: Must unlock audio first during user gesture
    soundEngine.unlockAudio()
    soundEngine.playTestNote(noteName)
  }, [])

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Test Keyboard</Label>
      <div className="relative h-14">
        {/* White keys */}
        <div className="flex h-full gap-[1px]">
          {KEYBOARD_LAYOUT.map((key) => (
            <button
              key={key.white}
              onMouseDown={() => playNote(key.white)}
              onTouchStart={(e) => { e.preventDefault(); playNote(key.white) }}
              className="flex-1 bg-white border border-border rounded-b text-[6px] text-gray-400 flex items-end justify-center pb-0.5 hover:bg-gray-100 active:bg-gray-300 transition-colors touch-none"
            >
              {key.white.replace(/[0-9]/g, '')}
            </button>
          ))}
        </div>
        {/* Black keys - positioned absolutely */}
        <div className="absolute top-0 left-0 right-0 flex h-8 pointer-events-none">
          {KEYBOARD_LAYOUT.map((key, i) => {
            if (!key.black) return <div key={`space-${i}`} className="flex-1" />
            // Position black key between white keys
            return (
              <div key={key.black} className="flex-1 flex justify-end">
                <button
                  onMouseDown={() => playNote(key.black!)}
                  onTouchStart={(e) => { e.preventDefault(); playNote(key.black!) }}
                  className="w-[60%] h-full bg-gray-800 border border-gray-900 rounded-b text-[5px] text-gray-400 hover:bg-gray-700 active:bg-gray-600 transition-colors pointer-events-auto -mr-[30%] z-10 touch-none"
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SECTION COMPONENT
// =============================================================================

interface SectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-xs font-semibold text-foreground uppercase tracking-wide hover:text-primary transition-colors"
      >
        {title}
        <span className="text-muted-foreground">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <div className="space-y-2 pb-3">{children}</div>}
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SynthControlPanel({
  onSettingsChange,
  onReplay,
  open = false,
  onOpenChange,
  visualTheme = 'lego',
  onVisualThemeChange,
}: SynthControlPanelProps) {
  // Get sound engine and initial config
  const [config, setConfig] = useState<SynthConfiguration>(() => {
    const soundEngine = getSoundEngine()
    return soundEngine.getConfiguredSynth()
  })

  // Sound mode state
  const [soundMode, setSoundMode] = useState<SoundMode>(() => {
    const soundEngine = getSoundEngine()
    return soundEngine.getSoundMode()
  })

  // Update sound mode
  const updateSoundMode = useCallback((mode: SoundMode) => {
    const soundEngine = getSoundEngine()
    soundEngine.setSoundMode(mode)
    setSoundMode(mode)
  }, [])

  // Update config on a parameter change - takes effect immediately
  const updateConfig = useCallback(<K extends keyof SynthConfiguration>(
    key: K,
    value: SynthConfiguration[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value }
      const soundEngine = getSoundEngine()
      soundEngine.setSynthConfig(newConfig)
      onSettingsChange?.(newConfig)
      return newConfig
    })
  }, [onSettingsChange])

  // Play test note
  const playTestNote = useCallback(() => {
    const soundEngine = getSoundEngine()
    soundEngine.unlockAudio()
    soundEngine.playTestNote('E4')
  }, [])

  // Play test sequence
  const playTestSequence = useCallback(() => {
    const soundEngine = getSoundEngine()
    soundEngine.unlockAudio()
    soundEngine.playTestSequence()
  }, [])

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const soundEngine = getSoundEngine()
    soundEngine.resetConfiguration()
    const newConfig = soundEngine.getConfiguredSynth()
    setConfig(newConfig)
    onSettingsChange?.(newConfig)
  }, [onSettingsChange])

  const oscillatorTypes = SoundEngine.getOscillatorTypes()
  const filterTypes = SoundEngine.getFilterTypes()

  if (!open) return null

  return (
    <div
      className="fixed inset-y-0 right-0 z-[10001] flex"
      style={{ pointerEvents: 'none' }}
    >
      {/* Backdrop - semi-transparent, click to close */}
      <div
        className="flex-1"
        style={{ pointerEvents: 'auto' }}
        onClick={() => onOpenChange?.(false)}
      />

      {/* Panel */}
      <div
        className="w-[280px] bg-background/95 backdrop-blur-sm border-l border-border shadow-xl overflow-y-auto"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span>🎹</span> Synth
          </h2>
          <button
            onClick={() => onOpenChange?.(false)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Visual Theme Selection */}
          {onVisualThemeChange && (
            <div className="p-2 bg-muted/50 rounded space-y-2">
              <Label className="text-xs font-medium">Visual Theme</Label>
              <div className="flex gap-1">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onVisualThemeChange(option.value)}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      visualTheme === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sound Mode Toggle */}
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <div>
              <Label className="text-xs font-medium">Playback Mode</Label>
              <p className="text-xs text-muted-foreground">
                {soundMode === 'realtime' ? 'Play sounds as events happen' : 'Play sequence when block ends'}
              </p>
            </div>
            <Select
              value={soundMode}
              onValueChange={(value) => updateSoundMode(value as SoundMode)}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10002]">
                <SelectItem value="realtime" className="text-xs">Realtime</SelectItem>
                <SelectItem value="on-complete" className="text-xs">On Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scale Selection */}
          <Section title="Scale">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Root</Label>
                <Select
                  value={config.scaleRoot ?? 'C'}
                  onValueChange={(value) => updateConfig('scaleRoot', value as RootNote)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10002] max-h-60">
                    {SoundEngine.getRootNotes().map((note) => (
                      <SelectItem key={note} value={note} className="text-xs">
                        {note}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-[2] space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={config.scaleType ?? 'pentatonic'}
                  onValueChange={(value) => updateConfig('scaleType', value as ScaleType)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10002] max-h-60">
                    {SoundEngine.getScaleTypes().map((scale) => (
                      <SelectItem key={scale} value={scale} className="text-xs">
                        {scale.charAt(0).toUpperCase() + scale.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Slider
              label="Octave Shift"
              value={config.octaveShift ?? 0}
              min={-2}
              max={2}
              step={1}
              onChange={(v) => updateConfig('octaveShift', v)}
            />
          </Section>

          {/* Mini Keyboard */}
          <MiniKeyboard />

          {/* Playback Section */}
          <Section title="Playback">
            <div className="text-xs text-muted-foreground space-y-0.5 mb-2">
              <div className="flex justify-between">
                <span>Last sequence:</span>
                <span className="font-mono">{getSoundEngine().getLastSequenceCount()} notes</span>
              </div>
              <div className="flex justify-between">
                <span>Current buffer:</span>
                <span className="font-mono">{getSoundEngine().getCurrentCategoriesCount()} notes</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <Button
                  onClick={() => {
                    const soundEngine = getSoundEngine()
                    soundEngine.unlockAudio()
                    soundEngine.replayLastSequence()
                  }}
                  variant="default"
                  size="sm"
                  className="flex-1 text-xs h-7"
                  title="Replay the last completed sequence"
                >
                  Replay Last
                </Button>
                <Button
                  onClick={() => {
                    const soundEngine = getSoundEngine()
                    soundEngine.unlockAudio()
                    soundEngine.playCurrentBuffer()
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-7"
                  title="Preview notes collected so far"
                >
                  Preview Current
                </Button>
              </div>
              <div className="flex gap-1">
                <Button onClick={playTestSequence} variant="ghost" size="sm" className="flex-1 text-xs h-7">
                  Test Scale
                </Button>
                <Button onClick={playTestNote} variant="ghost" size="sm" className="flex-1 text-xs h-7">
                  Test Note
                </Button>
              </div>
            </div>
          </Section>

          {/* Oscillator Section */}
          <Section title="Oscillator">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Waveform</Label>
              <Select
                value={config.oscillatorType}
                onValueChange={(value) => updateConfig('oscillatorType', value as OscillatorType)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10002]">
                  {oscillatorTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Slider
              label="Detune"
              value={config.oscillatorDetune}
              min={-50}
              max={50}
              step={1}
              unit="¢"
              onChange={(v) => updateConfig('oscillatorDetune', v)}
            />
          </Section>

          {/* Envelope Section */}
          <Section title="Envelope">
            <Slider
              label="Attack"
              value={config.envelopeAttack}
              min={0.001}
              max={1}
              step={0.01}
              unit="s"
              onChange={(v) => updateConfig('envelopeAttack', v)}
            />
            <Slider
              label="Decay"
              value={config.envelopeDecay}
              min={0.01}
              max={1}
              step={0.01}
              unit="s"
              onChange={(v) => updateConfig('envelopeDecay', v)}
            />
            <Slider
              label="Sustain"
              value={config.envelopeSustain}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateConfig('envelopeSustain', v)}
            />
            <Slider
              label="Release"
              value={config.envelopeRelease}
              min={0.01}
              max={2}
              step={0.01}
              unit="s"
              onChange={(v) => updateConfig('envelopeRelease', v)}
            />
          </Section>

          {/* Filter Section */}
          <Section title="Filter">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={config.filterType}
                onValueChange={(value) => updateConfig('filterType', value as BiquadFilterType)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10002]">
                  {filterTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Slider
              label="Frequency"
              value={config.filterFrequency}
              min={100}
              max={8000}
              step={50}
              unit="Hz"
              onChange={(v) => updateConfig('filterFrequency', v)}
            />

            <Slider
              label="Resonance"
              value={config.filterQ}
              min={0.1}
              max={20}
              step={0.1}
              onChange={(v) => updateConfig('filterQ', v)}
            />
          </Section>

          {/* LFO Section */}
          <Section title="LFO" defaultOpen={false}>
            <Toggle
              label="Enable"
              checked={config.lfoEnabled}
              onChange={(v) => updateConfig('lfoEnabled', v)}
            />

            {config.lfoEnabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Target</Label>
                  <Select
                    value={config.lfoTarget}
                    onValueChange={(value) => updateConfig('lfoTarget', value as 'pitch' | 'amplitude' | 'filter')}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10002]">
                      <SelectItem value="pitch" className="text-xs">Pitch</SelectItem>
                      <SelectItem value="amplitude" className="text-xs">Amplitude</SelectItem>
                      <SelectItem value="filter" className="text-xs">Filter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Slider
                  label="Rate"
                  value={config.lfoFrequency}
                  min={0.1}
                  max={20}
                  step={0.1}
                  unit="Hz"
                  onChange={(v) => updateConfig('lfoFrequency', v)}
                />

                <Slider
                  label="Depth"
                  value={config.lfoDepth}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateConfig('lfoDepth', v)}
                />
              </>
            )}
          </Section>

          {/* Delay Section */}
          <Section title="Delay" defaultOpen={false}>
            <Toggle
              label="Enable"
              checked={config.delayEnabled}
              onChange={(v) => updateConfig('delayEnabled', v)}
            />

            {config.delayEnabled && (
              <>
                <Slider
                  label="Time"
                  value={config.delayTime}
                  min={0.01}
                  max={1}
                  step={0.01}
                  unit="s"
                  onChange={(v) => updateConfig('delayTime', v)}
                />

                <Slider
                  label="Feedback"
                  value={config.delayFeedback}
                  min={0}
                  max={0.9}
                  step={0.01}
                  onChange={(v) => updateConfig('delayFeedback', v)}
                />
              </>
            )}
          </Section>

          {/* Reset Button */}
          <Button onClick={resetToDefaults} variant="ghost" size="sm" className="w-full text-xs h-7">
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SynthControlPanel
