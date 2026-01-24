/**
 * Pixel Progress - Core Types
 *
 * A library for visualizing progress as unique, generative pixel art.
 * Domain-agnostic: knows nothing about sessions, files, or any specific use case.
 */

// =============================================================================
// GEOMETRY
// =============================================================================

export interface Vec2 {
  x: number
  y: number
}

export interface BoundingBox {
  min: Vec2
  max: Vec2
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// =============================================================================
// PROGRESS EVENTS (Input)
// =============================================================================

/**
 * A generic progress event. The consumer maps their domain events to these.
 */
export interface ProgressEvent {
  id: string
  category: string // Theme interprets this
  weight?: number // Progress contribution (default: 1)
  label?: string // Optional display text
  metadata?: Record<string, unknown>
  timestamp: Date
}

// =============================================================================
// EVENT BEHAVIOR (How events affect construction)
// =============================================================================

export type EventBehavior =
  | PieceBehavior
  | AnimationBehavior
  | ModifierBehavior
  | ComboBehavior

export interface PieceBehavior {
  type: 'piece'
  pieceCategory: string
  weight: number
  builderState?: BuilderState
}

export interface AnimationBehavior {
  type: 'animation'
  builderState: BuilderState
  sequence?: string
  duration?: number
  loop?: boolean
}

export interface ModifierBehavior {
  type: 'modifier'
  target: 'last' | 'random' | 'by-category' | string
  modification: PieceModification
  builderState?: BuilderState
}

export interface ComboBehavior {
  type: 'combo'
  pieceCategory: string
  weight: number
  builderState: BuilderState
  sequence?: string
}

export interface PieceModification {
  action: 'enhance' | 'repair' | 'transform' | 'highlight' | 'remove'
  visualEffect?: string
}

// =============================================================================
// CONSTRUCTION (The artifact being built)
// =============================================================================

export type ConstructionPhase =
  | 'empty' // No pieces yet
  | 'foundation' // First few pieces
  | 'building' // Active construction
  | 'detailing' // Fine details phase
  | 'complete' // Finished
  | 'showcase' // Static display

export interface Construction {
  id: string

  // The pieces that make up the construction
  pieces: ConstructionPiece[]

  // How pieces connect
  connections: Connection[]

  // Unified shape computed from pieces
  bounds: BoundingBox
  centerOfMass: Vec2

  // Metrics
  progress: number // 0-1
  pieceCount: number

  // Style derived from event patterns
  fingerprint: ConstructionFingerprint

  // Current state
  phase: ConstructionPhase
  startedAt?: Date
  completedAt?: Date
}

export interface ConstructionPiece {
  id: string

  // Source
  sourceEventId: string
  category: string

  // Visual
  variant: number
  color?: string
  size: number // 0.5 - 2.0

  // Placement
  position: Vec2
  rotation: number
  depth: number // Z-layer

  // Connections
  attachedTo?: string // Piece ID this grew from
  attachmentPoint: Vec2

  // Metadata from source event (for tool-specific styling)
  metadata?: Record<string, unknown>

  // State
  addedAt: number // Timestamp in ms (Date.now())
  animationComplete: boolean
}

export interface Connection {
  from: string // Piece ID
  to: string // Piece ID
  type: MergeStyle
  visualized: boolean // Whether to draw the connection
}

export type MergeStyle =
  | 'blend' // Soft edge blending (paint)
  | 'snap' // Hard connection (LEGO, puzzle)
  | 'mortar' // Fill gap between (bricks)
  | 'weld' // Fused connection (metal, circuit)
  | 'grow-from' // Organic growth (plants, crystals)
  | 'dock' // Mechanical attachment (space station)
  | 'wire' // Connected by line (circuit traces)

// =============================================================================
// CONSTRUCTION FINGERPRINT (Unique signature)
// =============================================================================

export interface ConstructionFingerprint {
  // Event distribution
  categoryRatios: Record<string, number>
  totalPieces: number
  totalEvents: number

  // Temporal patterns
  duration: number // Total time in ms
  burstiness: number // 0-1, how clustered events were
  averageInterval: number // Avg ms between events

  // Structural metrics
  aspectRatio: number // Width / height
  symmetry: number // 0-1, left/right balance
  density: number // Pieces per unit area

  // Derived characteristics
  mood: 'chaotic' | 'methodical' | 'exploratory' | 'focused' | 'iterative'
  complexity: 'simple' | 'moderate' | 'complex' | 'intricate'
}

// =============================================================================
// BUILDER (Entity that constructs the art)
// =============================================================================

export type BuilderState =
  | 'idle' // Ready, waiting
  | 'working' // Actively building
  | 'walking' // Moving to position
  | 'placing' // Placing a piece
  | 'waiting' // Impatiently waiting
  | 'searching' // Looking around
  | 'thinking' // Contemplating
  | 'receiving' // Getting input
  | 'frustrated' // Error reaction
  | 'celebrating' // Success!

export type BuilderType = 'character' | 'mechanical' | 'environmental' | 'hybrid'

export interface BuilderConfig {
  type: BuilderType
  showBuilder: boolean
  position?: Vec2
  animations: Record<BuilderState, string>
  idleBehaviors?: string[]
}

// =============================================================================
// PLACEMENT
// =============================================================================

export type PlacementStrategy =
  | 'organic' // Grow outward from edges
  | 'grid' // Snap to grid
  | 'layered' // Stack in layers
  | 'radial' // Spiral from center
  | 'flow' // Follow a path
  | 'gravity' // Fall and stack

export interface AttachmentPoint {
  position: Vec2
  normal: Vec2 // Direction piece should grow
  existingPieceId?: string
  edgeType?: 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right'
}

export interface PlacementResult {
  position: Vec2
  rotation: number
  depth: number
  attachedTo?: string
  attachmentPoint: Vec2
}

// =============================================================================
// ANIMATION
// =============================================================================

export interface AnimationSequence {
  id: string
  keyframes: AnimationKeyframe[]
  duration: number // Total ms
  easing: EasingType
  loop: boolean | number // true = infinite, number = count
}

export interface AnimationKeyframe {
  time: number // 0-1 (percentage through animation)
  sprite?: SpriteRender
  offset?: Vec2
  scale?: number | Vec2
  rotation?: number
  opacity?: number
  effects?: FrameEffect[]
}

export interface SpriteRender {
  key: string
  frame?: number
  position: Vec2
  anchor?: Vec2 // 0-1, default center
  scale?: number | Vec2
  rotation?: number
  opacity?: number
  tint?: string
}

export interface FrameEffect {
  type: 'shake' | 'flash' | 'particles' | 'glow' | 'scanlines'
  intensity: number
  color?: string
  duration?: number
}

export type EasingType =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'bounce'
  | 'elastic'
  | 'back'

// =============================================================================
// THEME
// =============================================================================

export interface ThemeCategory {
  id: string
  name: string
  description: string
  behavior: 'piece' | 'animation' | 'modifier'
  pieceVariants?: number
  color?: string
  defaultWeight?: number
}

export interface ThemeManifest {
  id: string
  name: string
  description: string
  author?: string
  version?: string
  dimensions: { width: number; height: number }
  backgroundColor: string
  pixelScale: number
  palette: string[]
  categories: ThemeCategory[]
  builderType: BuilderType
  placementStrategy: PlacementStrategy
}

// =============================================================================
// RENDER STATE
// =============================================================================

export interface BubbleInfo {
  text: string
  style: 'working' | 'waiting' | 'done' | 'fading'
}

export interface RenderState {
  construction: Construction
  builder: {
    state: BuilderState
    position: Vec2
    currentAnimation?: string
    animationProgress: number
    bubble?: BubbleInfo | null
  }
  currentEvent?: ProgressEvent
  animationQueue: QueuedAnimation[]
  time: number
  deltaTime: number
}

export interface QueuedAnimation {
  id: string
  event: ProgressEvent
  behavior: EventBehavior
  phases: AnimationPhase[]
  currentPhase: number
  startedAt?: number
}

export type AnimationPhase =
  | { type: 'builder-move'; to: Vec2; duration: number }
  | { type: 'builder-state'; state: BuilderState; duration?: number }
  | { type: 'builder-animation'; sequence: string; duration: number }
  | { type: 'add-piece'; piece: ConstructionPiece }
  | { type: 'merge-animation'; pieceId: string; duration: number }
  | { type: 'modify-piece'; pieceId: string; modification: PieceModification }
  | { type: 'wait-for-next' }
  | { type: 'delay'; duration: number }
  | { type: 'sound'; sound: string }
  | { type: 'particles'; config: ParticleConfig }

export interface ParticleConfig {
  type: 'confetti' | 'sparks' | 'dust' | 'magic'
  position: Vec2
  count: number
  spread: number
  colors?: string[]
  duration: number
}

// =============================================================================
// STATISTICS
// =============================================================================

export interface ConstructionStats {
  // Event counts
  totalEvents: number
  eventsByCategory: Record<string, number>

  // Piece counts
  totalPieces: number
  piecesByCategory: Record<string, number>

  // Interaction
  userInputCount: number
  waitTime: number // ms spent waiting

  // Execution
  toolUseCount: number
  errorCount: number

  // Resources (optional, provided by consumer)
  tokensUsed?: number
  apiCalls?: number

  // Time
  totalDuration: number // ms
  activeDuration: number // ms excluding waits

  // Derived
  piecesPerMinute: number
  complexity: number // 0-1 score
}

// =============================================================================
// EXPORT
// =============================================================================

export interface ConstructionExport {
  version: string
  themeId: string
  themeVersion?: string

  construction: {
    id: string
    pieces: ExportedPiece[]
    connections: Connection[]
    fingerprint: ConstructionFingerprint
  }

  events: ExportedEvent[]
  stats: ConstructionStats

  metadata: {
    title?: string
    description?: string
    createdAt: string // ISO date
    duration: number
    source?: string
    sourceId?: string
    customData?: Record<string, unknown>
  }
}

export interface ExportedPiece {
  id: string
  sourceEventId: string
  category: string
  variant: number
  color?: string
  size: number
  position: Vec2
  rotation: number
  depth: number
  attachedTo?: string
  attachmentPoint: Vec2
  addedAtOffset: number // ms from start
}

export interface ExportedEvent {
  id: string
  category: string
  weight: number
  label?: string
  timestampOffset: number // ms from start
  metadata?: Record<string, unknown>
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface PixelProgressConfig {
  // Animation
  animationSpeed: number // 0.5 - 4
  queueBehavior: 'sequential' | 'batch' | 'interrupt'

  // Builder
  showBuilder: boolean
  builderSpeed: number

  // Construction
  maxPieces?: number
  mergeAggression: number // 0-1

  // Sound
  soundEnabled: boolean
  soundVolume: number // 0-1

  // Completion
  completionCelebration: boolean
  showcaseMode: 'static' | 'slow-rotate' | 'highlight-pieces'
  showSummaryOnComplete: boolean

  // Progress
  showProgressBar: boolean
  progressBarPosition: 'top' | 'bottom' | 'none'
}

export const DEFAULT_CONFIG: PixelProgressConfig = {
  animationSpeed: 1,
  queueBehavior: 'sequential',
  showBuilder: true,
  builderSpeed: 1,
  mergeAggression: 0.7,
  soundEnabled: false,
  soundVolume: 0.5,
  completionCelebration: true,
  showcaseMode: 'static',
  showSummaryOnComplete: true,
  showProgressBar: true,
  progressBarPosition: 'bottom',
}

// =============================================================================
// EVENT MAPPING (Consumer provides this)
// =============================================================================

export interface EventMapping {
  [domainEventType: string]: {
    category: string
    behavior?: 'piece' | 'animation' | 'modifier'
    weight?: number
    label?: (event: ProgressEvent) => string
  }
}
