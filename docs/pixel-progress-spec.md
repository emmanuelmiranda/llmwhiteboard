# Pixel Progress: Generative Construction Visualizer

> A library for visualizing progress as unique, generative pixel art that builds over time.

## Core Concept

**Events come in → A unique piece of art gets constructed → The final artifact is exportable**

Each session/process creates a one-of-a-kind visual artifact determined by:
- **What** events occurred (types/categories)
- **How many** of each type
- **What order** they happened
- **The timing/rhythm** of events
- **Relationships** between events

Two different sessions = Two completely different artworks.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Event Classification](#event-classification)
3. [Construction Mechanics](#construction-mechanics)
4. [Builder Types](#builder-types)
5. [Theme Specifications](#theme-specifications)
6. [Export & Replay System](#export--replay-system)
7. [Summary & Statistics](#summary--statistics)
8. [Component API](#component-api)
9. [File Structure](#file-structure)
10. [Implementation Phases](#implementation-phases)

---

## Core Philosophy

### Not Just Animation - CONSTRUCTION

This is NOT:
- ❌ Animations playing in response to events
- ❌ Things dropping into a bucket
- ❌ Random visual effects

This IS:
- ✅ Pieces **merging together** into a unified whole
- ✅ A construction that **grows cohesively**
- ✅ Each piece **connects to** existing pieces
- ✅ The final result is **one unified artwork**

### The Puzzle/Building Metaphor

Think of it like:
- A painter adding strokes that blend together
- LEGO bricks snapping into place
- A building being constructed brick by brick
- A circuit board being soldered component by component
- Puzzle pieces interlocking

**Key insight:** Pieces don't just appear - they GROW FROM or ATTACH TO what already exists.

---

## Event Classification

Events fall into distinct categories based on what they DO to the construction:

### Piece Events (Add to Construction)

These events **add permanent visual elements** to the artwork.

```typescript
interface PieceEvent {
  type: 'piece'
  piece: {
    category: string           // Visual category (stroke, brick, component, etc.)
    variants: string[]         // Available visual variants
    mergeStyle: MergeStyle     // How it connects to existing pieces
    weight: number             // Progress contribution (0-1)
  }
  builderAnimation?: string    // Optional builder animation while adding
}

type MergeStyle =
  | 'blend'      // Soft edge blending (paint)
  | 'snap'       // Hard connection (LEGO, puzzle)
  | 'mortar'     // Fill gap between (bricks)
  | 'weld'       // Fused connection (metal, circuit)
  | 'grow-from'  // Organic growth (plants, crystals)
  | 'dock'       // Mechanical attachment (space station)
  | 'wire'       // Connected by line (circuit traces)
```

### Animation Events (Visual Feedback Only)

These events **don't add pieces** - they show activity/state through the builder or environment.

```typescript
interface AnimationEvent {
  type: 'animation'
  animation: {
    builderState?: BuilderState    // State change for builder entity
    sequence: string               // Animation sequence name
    duration?: number              // Fixed duration or until interrupted
    loop?: boolean                 // Loop until next event
    environment?: EnvironmentEffect // Optional environment changes
  }
}

type BuilderState =
  | 'idle'           // Ready, waiting
  | 'working'        // Actively building
  | 'waiting'        // Impatiently waiting (tap watch, tap foot)
  | 'searching'      // Looking around, examining
  | 'thinking'       // Contemplating, planning
  | 'receiving'      // Getting input/instructions
  | 'frustrated'     // Error/problem reaction
  | 'celebrating'    // Success, completion
```

### Modifier Events (Change Existing Pieces)

These events **modify pieces already in the construction**.

```typescript
interface ModifierEvent {
  type: 'modifier'
  target: 'last' | 'random' | 'by-category' | string  // Which piece(s) to modify
  modification: {
    action: 'enhance' | 'repair' | 'transform' | 'highlight' | 'remove'
    visualEffect: string
  }
  builderAnimation?: string
}
```

### Combo Events (Both Piece + Animation)

Some events do both - the builder performs an action AND adds a piece.

```typescript
interface ComboEvent {
  type: 'combo'
  piece: PieceEvent['piece']
  animation: AnimationEvent['animation']
}
```

### Standard Category Mapping

Suggested mapping from common event types:

| Event Type | Behavior | Builder State | Notes |
|------------|----------|---------------|-------|
| `start` | piece | working | Foundation/first piece |
| `end` | animation | celebrating | Completion celebration |
| `create` | piece | working | Primary construction |
| `modify` | modifier | working | Enhance existing |
| `execute` | piece | working | Functional elements |
| `search` | animation | searching | Looking, scanning |
| `analyze` | animation | thinking | Examining, studying |
| `input` | animation | receiving | Getting instructions |
| `wait` | animation (loop) | waiting | Impatiently waiting |
| `error` | animation | frustrated | Problem reaction |
| `cleanup` | modifier | working | Optimize/remove |
| `success` | animation | celebrating | Mini celebration |

---

## Construction Mechanics

### Unified Construction Model

The construction is **one unified entity**, not a collection of separate pieces.

```typescript
interface Construction {
  id: string

  // The pieces that make up the construction
  pieces: ConstructionPiece[]

  // How pieces connect (graph structure)
  connections: Connection[]

  // Unified shape (computed from pieces)
  silhouette: Path2D
  bounds: BoundingBox
  centerOfMass: Vec2

  // Metrics
  progress: number              // 0-1 completion
  pieceCount: number
  density: number               // How tightly packed

  // Style derived from event patterns
  fingerprint: ConstructionFingerprint

  // Current state
  phase: ConstructionPhase
}

interface ConstructionPiece {
  id: string

  // Source
  sourceEventId: string
  category: string

  // Visual
  variant: number
  color?: string
  size: number

  // Placement
  position: Vec2
  rotation: number
  depth: number                 // Z-layer

  // Connections
  attachedTo?: string           // Piece ID this grew from
  attachmentPoint: Vec2

  // State
  addedAt: Date
  animationComplete: boolean
}

interface Connection {
  from: string                  // Piece ID
  to: string                    // Piece ID
  type: MergeStyle
  visualized: boolean           // Whether connection is drawn (wires, mortar lines)
}

type ConstructionPhase =
  | 'empty'        // No pieces yet
  | 'foundation'   // First few pieces
  | 'building'     // Active construction
  | 'detailing'    // Fine details phase
  | 'complete'     // Finished
  | 'showcase'     // Static display
```

### Piece Placement & Merging

New pieces don't just appear - they **attach to and grow from** existing pieces.

```typescript
interface PlacementEngine {
  /**
   * Find where a new piece should attach to the construction
   */
  findAttachmentPoint(
    construction: Construction,
    newPiece: Partial<ConstructionPiece>,
    strategy: PlacementStrategy
  ): AttachmentPoint

  /**
   * Create the merge animation (piece growing from attachment)
   */
  createMergeAnimation(
    piece: ConstructionPiece,
    attachment: AttachmentPoint,
    style: MergeStyle
  ): AnimationSequence

  /**
   * Update unified silhouette after piece added
   */
  rebuildSilhouette(construction: Construction): Path2D
}

interface AttachmentPoint {
  position: Vec2
  normal: Vec2                  // Direction piece should grow
  existingPieceId?: string      // What it attaches to
  edgeType?: 'outer' | 'inner' | 'top' | 'side'
}

type PlacementStrategy =
  | 'organic'      // Grow outward from center/edges
  | 'grid'         // Snap to grid positions
  | 'layered'      // Stack in layers
  | 'radial'       // Spiral outward from center
  | 'flow'         // Follow a path/curve
  | 'gravity'      // Fall and stack (Tetris-like)
```

### Construction Fingerprint

Each construction has a unique "fingerprint" based on how it was built:

```typescript
interface ConstructionFingerprint {
  // Event distribution
  categoryRatios: Record<string, number>  // { create: 0.4, modify: 0.2, ... }
  totalPieces: number
  totalEvents: number

  // Temporal patterns
  duration: number              // Total time
  burstiness: number            // 0-1, how clustered events were
  averageInterval: number       // Avg time between events

  // Structural metrics
  aspectRatio: number           // Wide vs tall
  symmetry: number              // 0-1, left/right balance
  branchingFactor: number       // Linear vs spread out
  layerCount: number            // Depth of construction

  // Derived characteristics
  mood: 'chaotic' | 'methodical' | 'exploratory' | 'focused' | 'iterative'
  complexity: 'simple' | 'moderate' | 'complex' | 'intricate'
}
```

---

## Builder Types

Not all themes have a human-like "craftsman". The **builder** is whatever entity/force constructs the art.

### Builder Categories

#### 1. Character Builders (Human-like)

A visible character who performs actions.

```typescript
interface CharacterBuilder {
  type: 'character'

  // Visual
  sprite: SpriteSheet
  position: Vec2
  facing: 'left' | 'right'

  // State
  state: BuilderState
  currentAnimation?: string

  // Movement
  canMove: boolean
  moveSpeed: number
  workPosition: Vec2            // Where they stand to work

  // Animations per state
  animations: Record<BuilderState, AnimationSequence>

  // Idle behaviors (what they do when waiting)
  idleBehaviors: IdleBehavior[]
}

// Examples:
// - Painter at easel
// - Construction worker with hard hat
// - Engineer with soldering iron
// - Astronomer with telescope
// - Chef in kitchen
// - Wizard at cauldron
```

#### 2. Mechanical Builders (Machines)

Machines/robots that build automatically.

```typescript
interface MechanicalBuilder {
  type: 'mechanical'

  // Components
  components: MachineComponent[]  // Arms, conveyors, presses, etc.

  // State
  state: 'idle' | 'active' | 'processing' | 'error' | 'complete'
  activeComponent?: string

  // Animations
  componentAnimations: Record<string, AnimationSequence>

  // Environment
  ambientAnimations: AnimationSequence[]  // Conveyor moving, lights blinking
}

// Examples:
// - Factory assembly line with robot arms
// - 3D printer laying down layers
// - Automated construction crane
// - Circuit board pick-and-place machine
```

#### 3. Environmental Builders (Forces of Nature)

No visible entity - pieces appear through environmental effects.

```typescript
interface EnvironmentalBuilder {
  type: 'environmental'

  // How pieces appear
  appearanceEffect: AppearanceEffect

  // Ambient environment
  ambientEffects: EnvironmentEffect[]

  // State changes
  stateEffects: Record<BuilderState, EnvironmentEffect>
}

type AppearanceEffect =
  | 'fall-from-sky'      // Pieces drop down
  | 'rise-from-ground'   // Pieces emerge upward
  | 'fade-in'            // Materialize in place
  | 'grow'               // Organic growth
  | 'crystallize'        // Form from particles
  | 'lightning-strike'   // Dramatic appearance

// Examples:
// - Tetris-like falling blocks
// - Garden growing from seeds
// - Constellation stars appearing in sky
// - Crystal cave forming
// - City rising from ground
```

#### 4. Hybrid Builders

Combination of above types.

```typescript
interface HybridBuilder {
  type: 'hybrid'

  // Multiple builder entities
  builders: (CharacterBuilder | MechanicalBuilder | EnvironmentalBuilder)[]

  // Which builder handles which events
  routing: Record<string, string>  // eventCategory → builderId
}

// Examples:
// - Factory with both robot arms AND a human supervisor
// - Garden with gardener AND natural growth
// - Space station with astronaut AND automated systems
```

---

## Theme Specifications

### Theme Interface

```typescript
interface ConstructionTheme {
  // Identity
  readonly id: string
  readonly name: string
  readonly description: string
  readonly author?: string
  readonly version?: string

  // Canvas
  readonly dimensions: { width: number; height: number }
  readonly backgroundColor: string | GradientDef | ((construction: Construction) => string)
  readonly pixelScale: number   // 1-8

  // Color palette (for consistency)
  readonly palette: string[]

  // Builder configuration
  readonly builder: BuilderConfig

  // Event categories this theme understands
  readonly categories: ThemeCategory[]

  // Placement strategy
  readonly placementStrategy: PlacementStrategy
  readonly placementParams: Record<string, unknown>

  // Asset loading
  load(): Promise<void>
  dispose?(): void

  // Core methods
  classifyEvent(event: ProgressEvent): EventBehavior
  createPiece(event: ProgressEvent, construction: Construction): ConstructionPiece | null
  getPlacement(piece: Partial<ConstructionPiece>, construction: Construction): PlacementResult
  getMergeAnimation(piece: ConstructionPiece, attachment: AttachmentPoint): AnimationSequence
  getBuilderAnimation(state: BuilderState, context: AnimationContext): AnimationSequence

  // Rendering
  render(ctx: CanvasRenderingContext2D, state: RenderState): void
  renderPiece(ctx: CanvasRenderingContext2D, piece: ConstructionPiece): void
  renderBuilder(ctx: CanvasRenderingContext2D, builder: BuilderState): void
  renderConnections(ctx: CanvasRenderingContext2D, connections: Connection[]): void

  // Completion
  getCompletionAnimation(construction: Construction): AnimationSequence

  // Export
  renderFinalArt(construction: Construction, resolution: number): Promise<ImageBitmap>
}

interface ThemeCategory {
  id: string
  name: string
  description: string
  behavior: 'piece' | 'animation' | 'modifier'
  pieceVariants?: number        // How many visual variants
  color?: string                // Category color (for UI)
  examples?: string[]           // Example event types that map here
}
```

### Theme Catalog

#### 1. Painter Theme
- **Builder:** Character (artist at easel)
- **Construction:** Abstract/impressionist painting
- **Pieces:** Brush strokes that blend together
- **Style:** Wet-on-wet blending, color harmony from events

#### 2. Builder Theme
- **Builder:** Character (construction worker)
- **Construction:** Pixel building/structure
- **Pieces:** Bricks, blocks, windows, doors
- **Style:** Stacking with mortar, structural integrity

#### 3. Factory Theme
- **Builder:** Mechanical (assembly line)
- **Construction:** Complex machine/device
- **Pieces:** Gears, pipes, panels, components
- **Style:** Mechanical connections, functional appearance

#### 4. Circuit Theme
- **Builder:** Character (engineer) or Mechanical (pick-and-place)
- **Construction:** Circuit board
- **Pieces:** Components connected by traces
- **Style:** Grid-based, electrical connections visualized

#### 5. Space Station Theme
- **Builder:** Environmental (docking) + Character (astronaut)
- **Construction:** Orbital station
- **Pieces:** Modules that dock together
- **Style:** Radial growth from core, modular connections

#### 6. Garden Theme
- **Builder:** Character (gardener) + Environmental (growth)
- **Construction:** Pixel garden
- **Pieces:** Plants, flowers, features
- **Style:** Organic growth, layered depth

#### 7. Constellation Theme
- **Builder:** Character (astronomer) + Environmental (stars appearing)
- **Construction:** Star constellation
- **Pieces:** Stars of varying brightness
- **Style:** Final reveal draws connecting lines

#### 8. Potion Theme
- **Builder:** Character (wizard)
- **Construction:** Layered potion in bottle
- **Pieces:** Ingredients that layer and blend
- **Style:** Color mixing, liquid layers

#### 9. Terrarium Theme
- **Builder:** Environmental (natural growth)
- **Construction:** Mini ecosystem in glass
- **Pieces:** Soil, plants, creatures, decorations
- **Style:** Layered environment, organic placement

#### 10. Pixel City Theme
- **Builder:** Environmental (rising from ground)
- **Construction:** City skyline
- **Pieces:** Buildings of various heights
- **Style:** Grid streets, height variation

---

## Export & Replay System

### Export Format

The construction can be exported as JSON for replay/sharing.

```typescript
interface ConstructionExport {
  // Version for compatibility
  version: string               // e.g., "1.0.0"

  // Theme used
  themeId: string
  themeVersion?: string

  // The construction data
  construction: {
    id: string
    pieces: ExportedPiece[]
    connections: Connection[]
    fingerprint: ConstructionFingerprint
  }

  // Event history (for replay)
  events: ExportedEvent[]

  // Statistics
  stats: ConstructionStats

  // Metadata
  metadata: {
    title?: string
    description?: string
    createdAt: string           // ISO date
    duration: number            // Total time in ms
    source?: string             // e.g., "llm-whiteboard", "ci-pipeline"
    sourceId?: string           // e.g., session ID
    customData?: Record<string, unknown>
  }
}

interface ExportedPiece {
  id: string
  sourceEventId: string
  category: string
  variant: number
  color?: string
  size: number
  position: { x: number; y: number }
  rotation: number
  depth: number
  attachedTo?: string
  attachmentPoint: { x: number; y: number }
  addedAtOffset: number         // ms from start
}

interface ExportedEvent {
  id: string
  category: string
  weight: number
  label?: string
  timestamp: number             // ms from start
  metadata?: Record<string, unknown>
}
```

### Export Functions

```typescript
interface ArtifactExporter {
  /**
   * Export as JSON for replay
   */
  exportJSON(construction: Construction, events: ProgressEvent[]): ConstructionExport

  /**
   * Export final art as PNG at various resolutions
   */
  exportPNG(
    construction: Construction,
    options: {
      resolution: '1x' | '2x' | '4x' | 'print'  // print = 300dpi
      includeStats?: boolean     // Render stats overlay
      background?: 'theme' | 'transparent' | string
    }
  ): Promise<Blob>

  /**
   * Export as animated GIF showing construction process
   */
  exportGIF(
    construction: Construction,
    events: ProgressEvent[],
    options: {
      duration: number           // Total GIF duration in seconds
      fps: number                // Frames per second
      size: 'small' | 'medium' | 'large'
      loop: boolean
    }
  ): Promise<Blob>

  /**
   * Export as SVG (vector, scalable)
   */
  exportSVG(construction: Construction): Promise<string>

  /**
   * Generate shareable thumbnail
   */
  generateThumbnail(
    construction: Construction,
    size: { width: number; height: number }
  ): Promise<string>  // Data URL
}
```

### Replay Player

A standalone player that consumes exported JSON:

```typescript
interface ReplayPlayer {
  /**
   * Load a construction export
   */
  load(data: ConstructionExport): Promise<void>

  /**
   * Playback controls
   */
  play(): void
  pause(): void
  stop(): void
  seek(timeMs: number): void
  setSpeed(multiplier: number): void

  /**
   * State
   */
  readonly isPlaying: boolean
  readonly currentTime: number
  readonly duration: number
  readonly progress: number      // 0-1

  /**
   * Events
   */
  onProgress?: (progress: number) => void
  onPieceAdded?: (piece: ConstructionPiece) => void
  onComplete?: () => void
}

// React component
interface ReplayViewerProps {
  data: ConstructionExport | string  // JSON or URL to JSON

  // Playback
  autoPlay?: boolean
  initialSpeed?: number
  showControls?: boolean

  // Display
  size?: 'sm' | 'md' | 'lg' | 'full'
  showStats?: boolean

  // Callbacks
  onLoad?: () => void
  onComplete?: () => void
  onError?: (error: Error) => void
}
```

### Viewer Page

Standalone page for viewing/replaying constructions:

```
/view/[id]              - View by ID (fetched from API)
/view?data=<base64>     - View from encoded data
/view?url=<url>         - View from external JSON URL
```

Features:
- Play/pause/scrub through construction
- Speed controls (0.25x - 4x)
- Export buttons (PNG, GIF, JSON)
- Stats panel
- Fullscreen mode
- Share link generation

---

## Summary & Statistics

At completion, display a summary of the construction process.

### Statistics Model

```typescript
interface ConstructionStats {
  // Event counts
  totalEvents: number
  eventsByCategory: Record<string, number>

  // Piece counts
  totalPieces: number
  piecesByCategory: Record<string, number>

  // User interaction
  userInputCount: number        // How many times user provided input
  waitTime: number              // Total time spent waiting for input

  // Execution
  toolUseCount: number          // Commands/tools executed
  errorCount: number            // Errors encountered

  // Resources (if available)
  tokensUsed?: number           // LLM tokens
  apiCalls?: number             // API calls made

  // Time
  totalDuration: number         // Total elapsed time
  activeDuration: number        // Time actually working (excluding waits)

  // Construction metrics
  constructionComplexity: number  // Derived score
  pieceDensity: number          // Pieces per unit area

  // Efficiency (optional)
  piecesPerMinute?: number
  eventsPerPiece?: number       // How many events per permanent piece
}
```

### Summary Display Component

```typescript
interface ConstructionSummaryProps {
  stats: ConstructionStats
  fingerprint: ConstructionFingerprint

  // Display options
  layout: 'overlay' | 'sidebar' | 'bottom' | 'modal'
  showDetails: boolean          // Expand to show full breakdown

  // Theming
  theme?: 'light' | 'dark' | 'match-construction'
}
```

### Summary Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                  [FINAL ARTWORK]                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ══════════════════════════════════════════════════════ │
│                    SESSION COMPLETE                     │
│  ══════════════════════════════════════════════════════ │
│                                                         │
│   📊 Statistics                                         │
│   ├── Events: 127 total                                │
│   │   ├── Creates: 34                                  │
│   │   ├── Modifies: 18                                 │
│   │   ├── Executes: 45                                 │
│   │   └── Searches: 30                                 │
│   │                                                     │
│   ├── User Inputs: 8                                   │
│   ├── Tool Uses: 89                                    │
│   ├── Tokens Used: 45,230                              │
│   │                                                     │
│   └── Duration: 12m 34s                                │
│                                                         │
│   🎨 Construction                                       │
│   ├── Pieces: 52                                       │
│   ├── Complexity: Intricate                            │
│   └── Style: Methodical                                │
│                                                         │
│   [Export PNG]  [Export GIF]  [Share]  [Save]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Component API

### Main Component

```typescript
interface PixelProgressProps {
  /** Unique identifier */
  id: string

  /** Event stream */
  events: ProgressEvent[]

  /** Current phase (controlled or auto) */
  phase?: ConstructionPhase

  /** Theme selection */
  theme?: string | ConstructionTheme

  /** Event mapping (your domain → standard categories) */
  eventMapping?: EventMapping

  /** Configuration */
  config?: PixelProgressConfig

  /** Size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  width?: number | string
  height?: number | string
  aspectRatio?: '16:9' | '4:3' | '1:1' | number

  /** Expandable/fullscreen */
  expandable?: boolean
  expanded?: boolean
  onExpandChange?: (expanded: boolean) => void

  /** Controls */
  showControls?: boolean
  controlsPosition?: 'top' | 'bottom' | 'overlay'

  /** Stats */
  showStats?: boolean
  stats?: Partial<ConstructionStats>  // Additional stats to include

  /** Export */
  showExportButton?: boolean
  onExport?: (exporter: ArtifactExporter) => void

  /** Callbacks */
  onPhaseChange?: (phase: ConstructionPhase) => void
  onProgress?: (progress: number) => void
  onPieceAdded?: (piece: ConstructionPiece) => void
  onComplete?: (construction: Construction, stats: ConstructionStats) => void

  /** Styling */
  className?: string
  style?: React.CSSProperties

  /** Custom rendering */
  renderOverlay?: (state: RenderState) => React.ReactNode
  renderSummary?: (stats: ConstructionStats) => React.ReactNode
}

interface PixelProgressConfig {
  // Animation
  animationSpeed: number        // 0.5 - 4
  queueBehavior: 'sequential' | 'batch' | 'interrupt'

  // Builder
  showBuilder: boolean
  builderSpeed: number

  // Construction
  maxPieces?: number
  mergeAggression: number       // 0-1, how tightly pieces cluster

  // Sound
  soundEnabled: boolean
  soundVolume: number           // 0-1

  // Completion
  completionCelebration: boolean
  showcaseMode: 'static' | 'slow-rotate' | 'highlight-pieces'
  showSummaryOnComplete: boolean

  // Progress indicator
  showProgressBar: boolean
  progressBarPosition: 'top' | 'bottom' | 'none'
}
```

### Event Mapping

Map your domain events to standard categories:

```typescript
interface EventMapping {
  [domainEventType: string]: {
    category: string            // Standard category
    behavior?: 'piece' | 'animation' | 'modifier'  // Override default
    weight?: number             // Progress contribution
    label?: (event: ProgressEvent) => string  // Custom label
  }
}

// Example: LLM Whiteboard session events
const SESSION_EVENT_MAPPING: EventMapping = {
  // Lifecycle
  'session_start': { category: 'start' },
  'session_end': { category: 'end' },
  'stop': { category: 'pause' },

  // Piece events (add to construction)
  'write': { category: 'create', weight: 2 },
  'edit': { category: 'modify', weight: 1.5 },
  'bash': { category: 'execute', weight: 1 },

  // Animation events (no piece)
  'read': { category: 'analyze', behavior: 'animation' },
  'glob': { category: 'search', behavior: 'animation' },
  'grep': { category: 'search', behavior: 'animation' },
  'todo_write': { category: 'analyze', behavior: 'animation' },

  // User interaction
  'user_prompt': { category: 'input' },
  'permission_needed': { category: 'wait' },

  // Status
  'error': { category: 'error' },
  'compaction': { category: 'cleanup' },
}
```

### Context Provider

For sharing state across multiple instances:

```typescript
interface PixelProgressProviderProps {
  children: React.ReactNode

  // Default configuration
  defaultTheme?: string
  defaultConfig?: Partial<PixelProgressConfig>

  // Theme assignment strategy
  themeAssignment?: ThemeAssignment

  // Persistence
  persistAssignments?: boolean  // Remember theme per ID
  storageKey?: string
}

type ThemeAssignment =
  | { type: 'fixed'; themeId: string }
  | { type: 'random' }
  | { type: 'rotate' }
  | { type: 'by-source'; mapping: Record<string, string> }
```

---

## File Structure

```
src/components/pixel-progress/
├── index.ts                          # Public exports
├── types.ts                          # Core types
├── constants.ts                      # Standard categories, defaults
│
├── core/
│   ├── ConstructionEngine.ts         # Main state machine
│   ├── PlacementEngine.ts            # Piece placement algorithms
│   ├── MergeEngine.ts                # How pieces connect
│   ├── AnimationQueue.ts             # Event → animation sequencing
│   ├── Renderer.ts                   # Canvas rendering
│   ├── SpriteManager.ts              # Sprite loading & caching
│   ├── SoundManager.ts               # Audio (optional)
│   └── ParticleSystem.ts             # Confetti, sparks, etc.
│
├── builders/
│   ├── CharacterBuilder.ts           # Human-like builder logic
│   ├── MechanicalBuilder.ts          # Machine builder logic
│   ├── EnvironmentalBuilder.ts       # Environmental effects
│   └── BuilderFactory.ts             # Create builder from config
│
├── placement/
│   ├── organic.ts                    # Organic growth placement
│   ├── grid.ts                       # Grid-based placement
│   ├── layered.ts                    # Layered/stacked placement
│   ├── radial.ts                     # Spiral/radial placement
│   ├── flow.ts                       # Path-following placement
│   └── gravity.ts                    # Physics-based placement
│
├── themes/
│   ├── index.ts                      # Theme registry
│   ├── base-theme.ts                 # Abstract base class
│   ├── painter/
│   │   ├── PainterTheme.ts
│   │   ├── sprites/
│   │   └── sounds/
│   ├── builder/
│   ├── factory/
│   ├── circuit/
│   ├── space-station/
│   ├── garden/
│   ├── constellation/
│   ├── potion/
│   └── [other themes]/
│
├── components/
│   ├── PixelProgress.tsx             # Main component
│   ├── PixelProgressProvider.tsx     # Context provider
│   ├── ExpandableContainer.tsx       # Fullscreen wrapper
│   ├── ThemePicker.tsx               # Theme selection UI
│   ├── AnimationControls.tsx         # Play/pause/speed
│   ├── ProgressBar.tsx               # Progress indicator
│   ├── StatsSummary.tsx              # Statistics display
│   └── ExportMenu.tsx                # Export options
│
├── export/
│   ├── Exporter.ts                   # Export orchestration
│   ├── PNGExporter.ts
│   ├── GIFExporter.ts
│   ├── SVGExporter.ts
│   ├── JSONExporter.ts
│   └── ThumbnailGenerator.ts
│
├── replay/
│   ├── ReplayEngine.ts               # Playback from JSON
│   ├── ReplayPlayer.tsx              # React component
│   └── ReplayControls.tsx            # Scrubber, speed, etc.
│
├── hooks/
│   ├── usePixelProgress.ts           # Main hook
│   ├── useConstruction.ts            # Construction state
│   ├── useTheme.ts                   # Theme management
│   ├── useAnimation.ts               # Animation frame loop
│   ├── useFullscreen.ts              # Fullscreen API
│   └── useExport.ts                  # Export functionality
│
├── utils/
│   ├── sprite-utils.ts
│   ├── canvas-utils.ts
│   ├── easing.ts
│   ├── color.ts
│   ├── geometry.ts                   # Vec2, bounds, etc.
│   ├── fingerprint.ts                # Construction analysis
│   └── stats.ts                      # Statistics calculation
│
└── demo/
    ├── page.tsx                      # /pixel-progress-demo route
    ├── MockEventGenerator.tsx
    ├── ThemeShowcase.tsx
    ├── ReplayDemo.tsx
    └── mock-data/
        ├── coding-session.json
        ├── ci-pipeline.json
        └── file-upload.json
```

---

## Implementation Status

### Completed Features

#### LEGO Theme (Primary Theme)
- [x] Side-view brick construction with stacking physics
- [x] LEGO minifig builder character with full animation states
- [x] Tool-specific brick colors (Read=blue, Write=green, Edit=orange, Bash=red, etc.)
- [x] Pending action system for tool_use_start/tool_use event pairs
- [x] Thought bubbles showing current action ("Reading...", "Writing...", etc.)
- [x] Horizontal scrolling for viewing long constructions
- [x] Scroll controls (arrows + scroll-to-end button)
- [x] Enhanced working animation (energetic arm swing, head bob, body tilt)
- [x] Motion effects (sweat drops, motion lines) for active states
- [x] Context compaction visualization (damage effect on bricks)

#### Sound Engine / Synthesizer
- [x] Full Web Audio API synthesizer with:
  - Multiple oscillator types (sine, triangle, square, sawtooth)
  - ADSR envelopes with configurable attack, decay, sustain, release
  - Biquad filters (lowpass, highpass, bandpass, notch)
  - LFO modulation (pitch, amplitude, filter)
  - Delay effect with feedback
- [x] Category-specific notes (each event type has unique pitch)
- [x] Tool-specific note overrides
- [x] Full chromatic scale support (C3-C6 with sharps)
- [x] Progressive configuration mode (early events configure synth)
- [x] Sustain hold time scales with envelope settings for longer notes

#### SynthControlPanel Component
- [x] Reusable side panel design (280px, slides in from right)
- [x] Mini keyboard with full chromatic scale (3 octaves)
- [x] All synth parameters configurable in real-time:
  - Oscillator type and detune
  - Full ADSR envelope controls
  - Filter type, frequency, and resonance
  - LFO enable, target, rate, depth
  - Delay enable, time, feedback
- [x] Settings apply immediately to all playback
- [x] Sliders don't auto-play (use keyboard to test changes)
- [x] Test sequence and replay buttons

#### Builder Animation System
- [x] Builder states: idle, working, thinking, searching, receiving, waiting, celebrating, frustrated
- [x] tool_use_start events keep builder animated until completion (no early timeout)
- [x] State-specific animations:
  - **Working**: Fast arm swing, head bob, body tilt, leg movement
  - **Thinking**: Looking around, hand gestures, weight shifting
  - **Searching**: Active scanning, pointing, leaning
  - **Receiving**: Nodding, acknowledgment gestures
  - **Waiting**: Impatient foot tap, watch checking
  - **Celebrating**: Jumping, arms raised
- [x] Base idle animation always present (subtle breathing motion)

#### Core Components
- [x] PixelProgress main component with all props
- [x] SessionPixelProgress for individual session views
- [x] TimelinePixelProgress for combined multi-session view
- [x] Fullscreen/expandable mode
- [x] Speed control (0.5x - 4x)
- [x] Replay functionality with history (2000 events max)
- [x] Sound toggle and volume control

#### Integration
- [x] SignalR real-time event streaming
- [x] Session detail page integration
- [x] Timeline view integration
- [x] Event mapping from session events to pixel-progress categories

### In Progress

#### Animation Debugging
- [ ] Verifying builder animation persists during long tool executions
- [ ] Console logging for state change tracing

### Planned Features

#### Export System
- [ ] PNG export at multiple resolutions
- [ ] GIF export of construction animation
- [ ] JSON export for replay/sharing
- [ ] Thumbnail generation

#### Additional Themes
- [ ] Painter theme (brush strokes)
- [ ] Circuit theme (components + traces)
- [ ] Factory theme (mechanical builder)
- [ ] Space station theme (modular docking)

#### Polish
- [ ] Summary overlay at completion
- [ ] Share functionality
- [ ] Theme picker UI

---

## Implementation Phases (Updated)

### Phase 1: Core Foundation ✅ COMPLETE
- [x] Core types and interfaces
- [x] Construction engine (state machine)
- [x] Basic placement engine (layered stacking)
- [x] Canvas renderer
- [x] Sprite-free procedural rendering

### Phase 2: LEGO Theme ✅ COMPLETE
- [x] CharacterBuilder implementation (minifig)
- [x] LEGO theme with all states
- [x] Brick pieces with tool-specific colors
- [x] Merge animations (drop from top)
- [x] Character animations (all states)
- [x] Thought bubbles and pending action system

### Phase 3: React Components ✅ COMPLETE
- [x] PixelProgress main component
- [x] SessionPixelProgress adapter
- [x] TimelinePixelProgress adapter
- [x] ExpandableContainer (fullscreen)
- [x] Speed and scroll controls

### Phase 4: Sound System ✅ COMPLETE
- [x] Full synthesizer engine
- [x] SynthControlPanel component
- [x] Category and tool-specific sounds
- [x] User-configurable synth parameters
- [x] Mini keyboard for testing

### Phase 5: Integration ✅ COMPLETE
- [x] Wire up to real SignalR events
- [x] Session detail page integration
- [x] Timeline view integration
- [x] Real-time event streaming

### Phase 6: Export System 🔲 PLANNED
- [ ] JSON export/import
- [ ] PNG export at multiple resolutions
- [ ] GIF export
- [ ] Thumbnail generation
- [ ] Stats calculation

### Phase 7: Additional Themes 🔲 PLANNED
- [ ] Painter theme
- [ ] Circuit theme
- [ ] Factory theme
- [ ] Garden theme

### Phase 8: Polish 🔲 PLANNED
- [ ] Summary overlay
- [ ] Celebration animations
- [ ] Share functionality
- [ ] Theme picker

---

## Usage Examples

### Basic Usage

```tsx
import { PixelProgress } from '@/components/pixel-progress'

function SessionViewer({ session, events }) {
  return (
    <PixelProgress
      id={session.id}
      events={events.map(mapToProgressEvent)}
      theme="painter"
      size="lg"
      expandable
      showControls
      onComplete={(construction, stats) => {
        console.log('Done!', stats)
      }}
    />
  )
}
```

### With Export

```tsx
function SessionWithExport({ session, events }) {
  const handleExport = async (exporter) => {
    const png = await exporter.exportPNG(construction, { resolution: '2x' })
    downloadBlob(png, `session-${session.id}.png`)
  }

  return (
    <PixelProgress
      id={session.id}
      events={events}
      showExportButton
      onExport={handleExport}
    />
  )
}
```

### Replay Viewer

```tsx
import { ReplayPlayer } from '@/components/pixel-progress/replay'

function ArtViewer({ constructionData }) {
  return (
    <ReplayPlayer
      data={constructionData}
      autoPlay
      showControls
      showStats
      size="full"
    />
  )
}
```

### Multiple Instances (Timeline)

```tsx
function TimelineView({ sessions }) {
  return (
    <PixelProgressProvider defaultTheme="random">
      <div className="timeline-grid">
        {sessions.map(session => (
          <PixelProgress
            key={session.id}
            id={session.id}
            events={session.events}
            size="sm"
            expandable
          />
        ))}
      </div>
    </PixelProgressProvider>
  )
}
```

---

## Open Questions

1. **Persistence:** Should constructions be saved server-side, or only client export?
2. **Sharing:** Public share links for viewing constructions?
3. **Themes:** Allow custom/user-created themes?
4. **Real-time collaboration:** Multiple viewers watching same construction live?
5. **Accessibility:** How to make visual progress accessible to screen readers?
6. **Mobile:** Touch interactions for expand/controls?

---

## References

- [PixiJS](https://pixijs.com/) - Potential rendering engine
- [Aseprite](https://www.aseprite.org/) - Pixel art tool for sprites
- [Lospec Palette List](https://lospec.com/palette-list) - 8-bit color palettes
- [GIF.js](https://jnordberg.github.io/gif.js/) - Client-side GIF encoding
