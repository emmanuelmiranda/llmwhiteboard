# Sound Engine Documentation

The pixel-progress sound engine is a mini synthesizer built on the Web Audio API. It provides dynamic, context-aware sounds that make the visualization feel alive.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Sound Engine                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Oscillators │───▶│    Filter    │───▶│   Envelope   │──┐   │
│  │  (multiple)  │    │  (optional)  │    │    (ADSR)    │  │   │
│  └──────────────┘    └──────────────┘    └──────────────┘  │   │
│         ▲                    ▲                             │   │
│         │                    │                             │   │
│  ┌──────┴──────┐     ┌──────┴──────┐                      │   │
│  │     LFO     │     │     LFO     │                      │   │
│  │ (pitch mod) │     │(filter mod) │                      │   │
│  └─────────────┘     └─────────────┘                      │   │
│                                                            │   │
│  ┌─────────────────────────────────────────────────────┐  │   │
│  │                    Delay Effect                      │◀─┘   │
│  │              ┌─────────────────────┐                │      │
│  │   Dry ──────▶│  DelayNode + Feedback │──▶ Wet       │      │
│  │              └─────────────────────┘                │      │
│  └─────────────────────────────────────────────────────┘      │
│                              │                                 │
│                              ▼                                 │
│                       Master Gain                              │
│                              │                                 │
│                              ▼                                 │
│                    AudioContext.destination                    │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Synth Patches

A "patch" is a preset configuration for the synthesizer. Each event category has its own patch that defines its characteristic sound.

```typescript
interface SynthPatch {
  oscillators: Array<{
    type: OscillatorType    // 'sine' | 'triangle' | 'square' | 'sawtooth'
    detune: number          // cents (-100 to 100 typical)
    volume: number          // 0-1
  }>
  envelope: ADSREnvelope
  filter?: FilterConfig
  lfo?: LFOConfig
  delay?: DelayConfig
}
```

### 2. ADSR Envelope

The envelope shapes the volume of each note over time:

```
Volume
  │
1 │      ╱╲
  │     ╱  ╲
S │    ╱    ╲────────────╲
  │   ╱                    ╲
0 │──╱                      ╲──
  └──────────────────────────────▶ Time
     A    D       S         R

A = Attack  - Time to reach peak volume
D = Decay   - Time to fall to sustain level
S = Sustain - Volume level held while note plays
R = Release - Time to fade to silence
```

### 3. Category Sound Mapping

Each event category maps to a musical note in a pentatonic scale:

| Category | Note | Frequency | Character |
|----------|------|-----------|-----------|
| start    | C4   | 261.63 Hz | Foundation |
| create   | E4   | 329.63 Hz | Bright, satisfying |
| modify   | D4   | 293.66 Hz | Neutral progression |
| execute  | A4   | 440.00 Hz | Action, emphasis |
| search   | G4   | 392.00 Hz | Exploratory |
| analyze  | G4   | 392.00 Hz | Investigative |
| input    | C5   | 523.25 Hz | High, attention |
| success  | E5   | 659.25 Hz | Triumphant |
| error    | C3   | 130.81 Hz | Low, warning |
| end      | C5   | 523.25 Hz | Resolution |

## Progressive Configuration Mode

The most unique feature is **Progressive Configuration Mode**, where the first N events "build" the synthesizer that will play subsequent notes.

### How It Works

```
Events 1-5 (Configuration Phase):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Event 1: "start"  → Sets oscillator type (sine/triangle/  │
│                      square/sawtooth)                       │
│                                                             │
│  Event 2: "create" → Sets filter type (lowpass/highpass/   │
│                      bandpass)                              │
│                                                             │
│  Event 3: "modify" → Enables/disables LFO                  │
│                                                             │
│  Event 4: "execute"→ Enables/disables delay effect         │
│                                                             │
│  Event 5: "search" → Sets filter frequency                 │
│                                                             │
│  Each plays a stock "configuration" sound (clicks/blips)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
Events 6+ (Performance Phase):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Uses the configured synth to play musical notes!          │
│                                                             │
│  The synth's character is unique to each session based     │
│  on what events occurred during configuration.             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Slots

| Category | Configures | Possible Values |
|----------|-----------|-----------------|
| start    | Oscillator type | sine, triangle, square, sawtooth |
| create   | Filter type | lowpass, highpass, bandpass, notch |
| modify   | LFO enabled | on, off |
| execute  | Delay enabled | on, off |
| search   | Filter frequency | 500-2500 Hz |
| analyze  | LFO frequency | 1-8 Hz |
| input    | Filter Q (resonance) | 1-8 |
| wait     | LFO depth | 0.05-0.25 |
| success  | Envelope sustain | 0.1-0.55 |
| error    | Oscillator detune | -5 to 5 cents |

### Example Session Sounds

**Session A** (lots of file creation):
- Events: start, create, create, modify, execute
- Configured synth: Square wave, lowpass filter, LFO on, delay on
- Result: Warm, pulsing tones with echo

**Session B** (heavy searching):
- Events: start, search, search, analyze, search
- Configured synth: Triangle wave, high filter freq, no LFO
- Result: Clean, bright notes

## Built-in Patches

### Default (Brick Placement)
```javascript
{
  oscillators: [
    { type: 'triangle', detune: 0, volume: 0.6 },
    { type: 'square', detune: 5, volume: 0.2 },
  ],
  envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
  filter: { type: 'lowpass', frequency: 2000, Q: 1 },
}
```
Short, clicky sound. Perfect for rapid piece placement.

### Create
```javascript
{
  oscillators: [
    { type: 'sine', detune: 0, volume: 0.5 },
    { type: 'triangle', detune: 7, volume: 0.3 },
  ],
  envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.2 },
  filter: { type: 'lowpass', frequency: 3000, Q: 2 },
}
```
Bright, satisfying sound for file creation.

### Error
```javascript
{
  oscillators: [
    { type: 'square', detune: 0, volume: 0.3 },
    { type: 'square', detune: 50, volume: 0.3 }, // Dissonance!
  ],
  envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.1 },
  filter: { type: 'lowpass', frequency: 600, Q: 8 },
}
```
Dissonant, alarming sound. The 50-cent detune creates an unsettling beat frequency.

### Success
```javascript
{
  oscillators: [
    { type: 'sine', detune: 0, volume: 0.4 },
    { type: 'triangle', detune: 1200, volume: 0.2 }, // Octave up
    { type: 'sine', detune: 700, volume: 0.15 },     // Fifth
  ],
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 },
  delay: { time: 0.2, feedback: 0.4, mix: 0.25 },
}
```
Triumphant chord with delay. The 1200 cents (octave) and 700 cents (fifth) create a major chord.

## LFO (Low Frequency Oscillator)

The LFO modulates other parameters to create movement:

### Pitch Modulation (Vibrato)
```typescript
lfo: { frequency: 4, depth: 0.1, target: 'pitch', waveform: 'sine' }
```
Creates a gentle vibrato effect.

### Amplitude Modulation (Tremolo)
```typescript
lfo: { frequency: 2, depth: 0.15, target: 'amplitude', waveform: 'sine' }
```
Creates a pulsing volume effect.

### Filter Modulation (Wah)
```typescript
lfo: { frequency: 3, depth: 0.3, target: 'filter', waveform: 'sine' }
```
Creates a "wah-wah" sweeping effect.

## Usage

### Basic Usage
```typescript
import { getSoundEngine } from './SoundEngine'

const soundEngine = getSoundEngine()
soundEngine.setEnabled(true)
soundEngine.setVolume(0.3)

// Play sound for an event category
soundEngine.playForCategory('create')
```

### Progressive Mode
```typescript
soundEngine.setProgressiveMode(true)
soundEngine.setConfigurationPhaseCount(5)

// First 5 events configure the synth
soundEngine.playForCategory('start')   // Configures oscillator
soundEngine.playForCategory('create')  // Configures filter
soundEngine.playForCategory('modify')  // Configures LFO
soundEngine.playForCategory('execute') // Configures delay
soundEngine.playForCategory('search')  // Configures filter freq

// Event 6+ plays notes with the configured synth
soundEngine.playForCategory('create')  // Plays actual musical note!
```

### Completion Fanfare
```typescript
// Play a celebratory arpeggio
soundEngine.playArpeggio()

// Or the full completion sequence (chord + arpeggio)
soundEngine.playCompletion()
```

## Rate Limiting

The engine includes built-in rate limiting (40ms minimum between sounds) to prevent audio clipping and CPU overload during rapid event bursts.

## Browser Compatibility

The engine uses the Web Audio API with fallbacks:
- `AudioContext` or `webkitAudioContext`
- Auto-resumes if suspended (browser policy)
- Gracefully degrades if Web Audio unavailable
