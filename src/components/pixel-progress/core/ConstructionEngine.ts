/**
 * Construction Engine
 *
 * Manages the state machine for building constructions.
 * Handles events, pieces, and phase transitions.
 */

import type {
  Construction,
  ConstructionPiece,
  ConstructionPhase,
  ConstructionFingerprint,
  Connection,
  ProgressEvent,
  EventBehavior,
  BuilderState,
  Vec2,
  BoundingBox,
  MergeStyle,
  QueuedAnimation,
  AnimationPhase,
} from '../types'

// =============================================================================
// CONSTRUCTION ENGINE
// =============================================================================

export interface ConstructionEngineConfig {
  maxPieces?: number
  foundationThreshold: number // Pieces before switching from foundation to building
  detailingThreshold: number // Progress before switching to detailing
}

// Position generator allows themes to control piece placement
export type PositionGenerator = (
  category: string,
  existingPieces: ConstructionPiece[]
) => Vec2

// Size generator allows themes to control piece sizes
export type SizeGenerator = (category: string) => number

const DEFAULT_ENGINE_CONFIG: ConstructionEngineConfig = {
  foundationThreshold: 5,
  detailingThreshold: 0.85,
}

export class ConstructionEngine {
  private construction: Construction
  private events: ProgressEvent[] = []
  private config: ConstructionEngineConfig
  private eventClassifier: (event: ProgressEvent) => EventBehavior
  private positionGenerator?: PositionGenerator
  private sizeGenerator?: SizeGenerator

  constructor(
    id: string,
    eventClassifier: (event: ProgressEvent) => EventBehavior,
    config: Partial<ConstructionEngineConfig> = {}
  ) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config }
    this.eventClassifier = eventClassifier
    this.construction = this.createEmptyConstruction(id)
  }

  /**
   * Set a custom position generator (typically provided by theme)
   */
  setPositionGenerator(generator: PositionGenerator): void {
    this.positionGenerator = generator
  }

  /**
   * Set a custom size generator (typically provided by theme)
   */
  setSizeGenerator(generator: SizeGenerator): void {
    this.sizeGenerator = generator
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  getConstruction(): Construction {
    return this.construction
  }

  getEvents(): ProgressEvent[] {
    return this.events
  }

  /**
   * Process a new event and update the construction
   */
  processEvent(event: ProgressEvent): {
    behavior: EventBehavior
    piece?: ConstructionPiece
    animation: QueuedAnimation
  } {
    this.events.push(event)

    const behavior = this.eventClassifier(event)
    let piece: ConstructionPiece | undefined

    // Create piece if this is a piece or combo event
    if (behavior.type === 'piece' || behavior.type === 'combo') {
      piece = this.createPiece(event, behavior)
      if (piece) {
        this.addPiece(piece)
      }
    }

    // Handle modifiers
    if (behavior.type === 'modifier') {
      this.applyModifier(event, behavior)
    }

    // Update construction state
    this.updatePhase()
    this.updateProgress()
    this.updateFingerprint()

    // Generate animation
    const animation = this.createAnimation(event, behavior, piece)

    return { behavior, piece, animation }
  }

  /**
   * Mark construction as complete
   */
  complete(): void {
    this.construction.phase = 'complete'
    this.construction.completedAt = new Date()
    this.construction.progress = 1
  }

  /**
   * Reset to empty state
   */
  reset(): void {
    this.construction = this.createEmptyConstruction(this.construction.id)
    this.events = []
  }

  // ===========================================================================
  // PIECE MANAGEMENT
  // ===========================================================================

  private createPiece(
    event: ProgressEvent,
    behavior: EventBehavior
  ): ConstructionPiece | undefined {
    if (behavior.type !== 'piece' && behavior.type !== 'combo') {
      return undefined
    }

    if (
      this.config.maxPieces &&
      this.construction.pieces.length >= this.config.maxPieces
    ) {
      return undefined
    }

    const pieceCategory = behavior.pieceCategory
    const existingOfCategory = this.construction.pieces.filter(
      (p) => p.category === pieceCategory
    )

    // Calculate placement - use custom generator if provided
    let position: Vec2
    let rotation = 0
    let attachedTo: string | undefined
    let attachmentPoint: Vec2 = { x: 0.5, y: 0.5 }

    if (this.positionGenerator) {
      // Use theme's position generator
      position = this.positionGenerator(pieceCategory, this.construction.pieces)
    } else {
      // Fall back to basic placement
      const placement = this.calculateBasicPlacement()
      position = placement.position
      rotation = placement.rotation
      attachedTo = placement.attachedTo
      attachmentPoint = placement.attachmentPoint
    }

    // Calculate size - use custom generator if provided
    const size = this.sizeGenerator
      ? this.sizeGenerator(pieceCategory)
      : 0.8 + Math.random() * 0.4

    const piece: ConstructionPiece = {
      id: `piece-${this.construction.pieces.length}-${Date.now()}`,
      sourceEventId: event.id,
      category: pieceCategory,
      variant: existingOfCategory.length % 8, // Cycle through variants
      size,
      position,
      rotation,
      // Depth based on Y position: LOWER Y (higher on screen) = higher depth = rendered last (in front)
      // For LEGO side-view: bricks on TOP should appear in front of bricks below
      // (upper brick's body covers lower brick's studs)
      depth: (1 - position.y) * 1000 + this.construction.pieces.length * 0.001,
      attachedTo,
      attachmentPoint,
      // Pass through metadata for tool-specific styling
      metadata: event.metadata,
      addedAt: Date.now(),
      animationComplete: false,
    }

    return piece
  }

  private addPiece(piece: ConstructionPiece): void {
    this.construction.pieces.push(piece)

    // Create connection if attached to existing piece
    if (piece.attachedTo) {
      const connection: Connection = {
        from: piece.attachedTo,
        to: piece.id,
        type: 'blend', // Default, theme will override
        visualized: false,
      }
      this.construction.connections.push(connection)
    }

    // Update bounds
    this.updateBounds()
  }

  private calculateBasicPlacement(): {
    position: Vec2
    rotation: number
    attachedTo?: string
    attachmentPoint: Vec2
  } {
    const pieces = this.construction.pieces

    if (pieces.length === 0) {
      // First piece at center
      return {
        position: { x: 0.5, y: 0.5 },
        rotation: 0,
        attachmentPoint: { x: 0.5, y: 0.5 },
      }
    }

    // Attach to a recent piece, grow outward
    const recentPieces = pieces.slice(-5)
    const attachTo = recentPieces[Math.floor(Math.random() * recentPieces.length)]

    // Calculate position relative to attachment
    const angle = Math.random() * Math.PI * 2
    const distance = 0.05 + Math.random() * 0.1
    const position: Vec2 = {
      x: Math.max(0.1, Math.min(0.9, attachTo.position.x + Math.cos(angle) * distance)),
      y: Math.max(0.1, Math.min(0.9, attachTo.position.y + Math.sin(angle) * distance)),
    }

    return {
      position,
      rotation: (Math.random() - 0.5) * 0.3,
      attachedTo: attachTo.id,
      attachmentPoint: attachTo.position,
    }
  }

  private applyModifier(
    event: ProgressEvent,
    behavior: EventBehavior
  ): void {
    if (behavior.type !== 'modifier') return

    const pieces = this.construction.pieces
    if (pieces.length === 0) return

    let targetPiece: ConstructionPiece | undefined

    switch (behavior.target) {
      case 'last':
        targetPiece = pieces[pieces.length - 1]
        break
      case 'random':
        targetPiece = pieces[Math.floor(Math.random() * pieces.length)]
        break
      default:
        targetPiece = pieces.find((p) => p.id === behavior.target)
    }

    if (!targetPiece) return

    // Apply modification
    switch (behavior.modification.action) {
      case 'enhance':
        targetPiece.size = Math.min(2, targetPiece.size * 1.1)
        break
      case 'transform':
        targetPiece.variant = (targetPiece.variant + 1) % 8
        break
      case 'remove':
        const idx = pieces.indexOf(targetPiece)
        if (idx > -1) pieces.splice(idx, 1)
        break
    }
  }

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  private updatePhase(): void {
    const pieceCount = this.construction.pieces.length
    const progress = this.construction.progress

    if (pieceCount === 0) {
      this.construction.phase = 'empty'
    } else if (pieceCount < this.config.foundationThreshold) {
      this.construction.phase = 'foundation'
    } else if (progress >= this.config.detailingThreshold) {
      this.construction.phase = 'detailing'
    } else {
      this.construction.phase = 'building'
    }
  }

  private updateProgress(): void {
    // Progress based on weighted events
    let totalWeight = 0
    for (const event of this.events) {
      const behavior = this.eventClassifier(event)
      if (behavior.type === 'piece' || behavior.type === 'combo') {
        totalWeight += behavior.weight
      }
    }

    // Asymptotic progress (never quite reaches 1 until complete)
    // Using logarithmic curve that approaches 1
    const k = 0.1 // Steepness
    this.construction.progress = Math.min(0.99, 1 - Math.exp(-k * totalWeight))
  }

  private updateBounds(): void {
    const pieces = this.construction.pieces
    if (pieces.length === 0) {
      this.construction.bounds = { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } }
      this.construction.centerOfMass = { x: 0.5, y: 0.5 }
      return
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    let sumX = 0,
      sumY = 0

    for (const piece of pieces) {
      minX = Math.min(minX, piece.position.x)
      minY = Math.min(minY, piece.position.y)
      maxX = Math.max(maxX, piece.position.x)
      maxY = Math.max(maxY, piece.position.y)
      sumX += piece.position.x
      sumY += piece.position.y
    }

    this.construction.bounds = {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY },
    }
    this.construction.centerOfMass = {
      x: sumX / pieces.length,
      y: sumY / pieces.length,
    }
  }

  private updateFingerprint(): void {
    const events = this.events
    const pieces = this.construction.pieces

    // Category ratios
    const categoryRatios: Record<string, number> = {}
    for (const event of events) {
      categoryRatios[event.category] = (categoryRatios[event.category] || 0) + 1
    }
    for (const cat of Object.keys(categoryRatios)) {
      categoryRatios[cat] /= events.length || 1
    }

    // Temporal patterns
    let totalInterval = 0
    for (let i = 1; i < events.length; i++) {
      totalInterval +=
        events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()
    }
    const averageInterval = events.length > 1 ? totalInterval / (events.length - 1) : 0

    // Calculate burstiness (coefficient of variation of intervals)
    let intervalVariance = 0
    for (let i = 1; i < events.length; i++) {
      const interval =
        events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()
      intervalVariance += Math.pow(interval - averageInterval, 2)
    }
    const stdDev = Math.sqrt(intervalVariance / (events.length - 1 || 1))
    const burstiness = Math.min(1, stdDev / (averageInterval || 1))

    // Structural metrics
    const bounds = this.construction.bounds
    const width = bounds.max.x - bounds.min.x || 1
    const height = bounds.max.y - bounds.min.y || 1
    const aspectRatio = width / height

    // Symmetry (compare left vs right piece counts)
    const centerX = this.construction.centerOfMass.x
    let leftCount = 0,
      rightCount = 0
    for (const piece of pieces) {
      if (piece.position.x < centerX) leftCount++
      else rightCount++
    }
    const symmetry = 1 - Math.abs(leftCount - rightCount) / (pieces.length || 1)

    // Density
    const area = width * height
    const density = pieces.length / (area * 100 || 1)

    // Determine mood based on patterns
    let mood: ConstructionFingerprint['mood'] = 'methodical'
    if (burstiness > 0.7) mood = 'chaotic'
    else if (categoryRatios['search'] > 0.3) mood = 'exploratory'
    else if (categoryRatios['modify'] > 0.3) mood = 'iterative'
    else if (density > 0.5) mood = 'focused'

    // Complexity based on piece count and variety
    const categoryCount = Object.keys(categoryRatios).length
    let complexity: ConstructionFingerprint['complexity'] = 'simple'
    if (pieces.length > 50 || categoryCount > 8) complexity = 'intricate'
    else if (pieces.length > 25 || categoryCount > 5) complexity = 'complex'
    else if (pieces.length > 10 || categoryCount > 3) complexity = 'moderate'

    const duration =
      events.length > 0
        ? events[events.length - 1].timestamp.getTime() -
          events[0].timestamp.getTime()
        : 0

    this.construction.fingerprint = {
      categoryRatios,
      totalPieces: pieces.length,
      totalEvents: events.length,
      duration,
      burstiness,
      averageInterval,
      aspectRatio,
      symmetry,
      density,
      mood,
      complexity,
    }
  }

  // ===========================================================================
  // ANIMATION GENERATION
  // ===========================================================================

  private createAnimation(
    event: ProgressEvent,
    behavior: EventBehavior,
    piece?: ConstructionPiece
  ): QueuedAnimation {
    const phases: AnimationPhase[] = []

    // Determine builder state
    let builderState: BuilderState = 'idle'
    if ('builderState' in behavior && behavior.builderState) {
      builderState = behavior.builderState
    }

    // Builder state change
    phases.push({
      type: 'builder-state',
      state: builderState,
      duration: 200,
    })

    // If adding a piece, include piece animation
    if (piece) {
      phases.push({
        type: 'builder-animation',
        sequence: 'work',
        duration: 300,
      })
      phases.push({
        type: 'add-piece',
        piece,
      })
      phases.push({
        type: 'merge-animation',
        pieceId: piece.id,
        duration: 400,
      })
    }

    // For wait events, loop until next event
    if (behavior.type === 'animation' && behavior.loop) {
      phases.push({ type: 'wait-for-next' })
    }

    // Return to idle
    if (builderState !== 'idle' && builderState !== 'waiting') {
      phases.push({
        type: 'builder-state',
        state: 'idle',
      })
    }

    return {
      id: `anim-${event.id}`,
      event,
      behavior,
      phases,
      currentPhase: 0,
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private createEmptyConstruction(id: string): Construction {
    return {
      id,
      pieces: [],
      connections: [],
      bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
      centerOfMass: { x: 0.5, y: 0.5 },
      progress: 0,
      pieceCount: 0,
      fingerprint: {
        categoryRatios: {},
        totalPieces: 0,
        totalEvents: 0,
        duration: 0,
        burstiness: 0,
        averageInterval: 0,
        aspectRatio: 1,
        symmetry: 1,
        density: 0,
        mood: 'methodical',
        complexity: 'simple',
      },
      phase: 'empty',
      startedAt: new Date(),
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createConstructionEngine(
  id: string,
  eventClassifier: (event: ProgressEvent) => EventBehavior,
  config?: Partial<ConstructionEngineConfig>
): ConstructionEngine {
  return new ConstructionEngine(id, eventClassifier, config)
}
