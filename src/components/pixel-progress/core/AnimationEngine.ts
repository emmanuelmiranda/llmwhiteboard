/**
 * AnimationEngine
 *
 * Manages animations for pieces flying in, snapping into place,
 * and builder movement. This creates the satisfying "building" feel.
 */

import type { Vec2 } from '../types'

// =============================================================================
// TYPES
// =============================================================================

export interface FlyingPiece {
  id: string
  pieceId: string
  startPosition: Vec2
  targetPosition: Vec2
  currentPosition: Vec2
  progress: number // 0 to 1
  duration: number // ms
  startTime: number
  state: 'flying' | 'snapping' | 'placed'
  onPlace?: () => void
}

export interface BuilderAnimation {
  startPosition: Vec2
  targetPosition: Vec2
  currentPosition: Vec2
  progress: number
  duration: number
  startTime: number
  state: 'idle' | 'walking' | 'placing' | 'returning'
  carryingPiece?: string
}

export interface SnapEffect {
  position: Vec2
  startTime: number
  duration: number
  intensity: number
}

// =============================================================================
// ANIMATION ENGINE
// =============================================================================

export class AnimationEngine {
  private flyingPieces: Map<string, FlyingPiece> = new Map()
  private builderAnimation: BuilderAnimation
  private snapEffects: SnapEffect[] = []
  private pendingPlacements: Array<{
    pieceId: string
    targetPosition: Vec2
    onPlace: () => void
  }> = []

  private builderHomePosition: Vec2 = { x: 0.85, y: 0.8 }
  private pieceSpawnPosition: Vec2 = { x: 1.1, y: 0.2 } // Off-screen right

  constructor() {
    this.builderAnimation = {
      startPosition: { ...this.builderHomePosition },
      targetPosition: { ...this.builderHomePosition },
      currentPosition: { ...this.builderHomePosition },
      progress: 1,
      duration: 0,
      startTime: 0,
      state: 'idle',
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Queue a piece to be placed. The builder will walk to position and place it.
   */
  queuePiecePlacement(
    pieceId: string,
    targetPosition: Vec2,
    onPlace: () => void
  ): void {
    this.pendingPlacements.push({ pieceId, targetPosition, onPlace })
  }

  /**
   * Start a piece flying directly to position (no builder involved)
   */
  flyPieceToPosition(
    pieceId: string,
    targetPosition: Vec2,
    duration: number = 400,
    onPlace?: () => void
  ): void {
    const flyingPiece: FlyingPiece = {
      id: `fly-${pieceId}-${Date.now()}`,
      pieceId,
      startPosition: { ...this.pieceSpawnPosition },
      targetPosition: { ...targetPosition },
      currentPosition: { ...this.pieceSpawnPosition },
      progress: 0,
      duration,
      startTime: performance.now(),
      state: 'flying',
      onPlace,
    }

    this.flyingPieces.set(flyingPiece.id, flyingPiece)
  }

  /**
   * Update all animations. Call this every frame.
   */
  update(time: number): void {
    this.updateFlyingPieces(time)
    this.updateBuilder(time)
    this.updateSnapEffects(time)
    this.processQueue(time)
  }

  /**
   * Get current builder position and state
   */
  getBuilderState(): {
    position: Vec2
    state: BuilderAnimation['state']
    carryingPiece?: string
  } {
    return {
      position: this.builderAnimation.currentPosition,
      state: this.builderAnimation.state,
      carryingPiece: this.builderAnimation.carryingPiece,
    }
  }

  /**
   * Get all flying pieces for rendering
   */
  getFlyingPieces(): FlyingPiece[] {
    return Array.from(this.flyingPieces.values())
  }

  /**
   * Get active snap effects for rendering
   */
  getSnapEffects(): SnapEffect[] {
    return this.snapEffects
  }

  /**
   * Check if there are pending animations
   */
  isBusy(): boolean {
    return (
      this.pendingPlacements.length > 0 ||
      this.flyingPieces.size > 0 ||
      this.builderAnimation.state !== 'idle'
    )
  }

  /**
   * Reset all animations
   */
  reset(): void {
    this.flyingPieces.clear()
    this.snapEffects = []
    this.pendingPlacements = []
    this.builderAnimation = {
      startPosition: { ...this.builderHomePosition },
      targetPosition: { ...this.builderHomePosition },
      currentPosition: { ...this.builderHomePosition },
      progress: 1,
      duration: 0,
      startTime: 0,
      state: 'idle',
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private updateFlyingPieces(time: number): void {
    const entries = Array.from(this.flyingPieces.entries())
    for (const [id, piece] of entries) {
      const elapsed = time - piece.startTime
      piece.progress = Math.min(1, elapsed / piece.duration)

      if (piece.state === 'flying') {
        // Ease out cubic for smooth deceleration
        const t = this.easeOutCubic(piece.progress)

        piece.currentPosition = {
          x: piece.startPosition.x + (piece.targetPosition.x - piece.startPosition.x) * t,
          y: piece.startPosition.y + (piece.targetPosition.y - piece.startPosition.y) * t,
        }

        // When flight completes, start snap
        if (piece.progress >= 1) {
          piece.state = 'snapping'
          piece.startTime = time
          piece.progress = 0
          piece.duration = 150 // Quick snap

          // Add snap effect
          this.snapEffects.push({
            position: { ...piece.targetPosition },
            startTime: time,
            duration: 300,
            intensity: 1,
          })
        }
      } else if (piece.state === 'snapping') {
        // Bounce effect during snap
        const t = piece.progress
        const bounce = t < 0.5
          ? 1 + Math.sin(t * Math.PI) * 0.15
          : 1 + Math.sin(t * Math.PI) * 0.05

        piece.currentPosition = {
          x: piece.targetPosition.x,
          y: piece.targetPosition.y - (1 - t) * 0.02, // Slight settle
        }

        if (piece.progress >= 1) {
          piece.state = 'placed'
          piece.currentPosition = { ...piece.targetPosition }

          // Trigger placement callback
          if (piece.onPlace) {
            piece.onPlace()
          }

          // Remove from flying pieces
          this.flyingPieces.delete(id)
        }
      }
    }
  }

  private updateBuilder(time: number): void {
    const builder = this.builderAnimation

    if (builder.state === 'idle') return

    const elapsed = time - builder.startTime
    builder.progress = Math.min(1, elapsed / builder.duration)

    const t = this.easeInOutQuad(builder.progress)

    builder.currentPosition = {
      x: builder.startPosition.x + (builder.targetPosition.x - builder.startPosition.x) * t,
      y: builder.startPosition.y + (builder.targetPosition.y - builder.startPosition.y) * t,
    }

    if (builder.progress >= 1) {
      if (builder.state === 'walking') {
        // Arrived at placement position, now place the piece
        builder.state = 'placing'
        builder.startTime = time
        builder.progress = 0
        builder.duration = 300

        // Fly the piece from builder to target
        if (builder.carryingPiece) {
          const pending = this.pendingPlacements.find(
            (p) => p.pieceId === builder.carryingPiece
          )
          if (pending) {
            this.flyPieceToPosition(
              pending.pieceId,
              pending.targetPosition,
              200,
              pending.onPlace
            )
          }
        }
      } else if (builder.state === 'placing') {
        // Done placing, return home
        builder.state = 'returning'
        builder.startPosition = { ...builder.currentPosition }
        builder.targetPosition = { ...this.builderHomePosition }
        builder.startTime = time
        builder.progress = 0
        builder.duration = 400
        builder.carryingPiece = undefined

        // Remove from pending
        this.pendingPlacements = this.pendingPlacements.filter(
          (p) => p.pieceId !== builder.carryingPiece
        )
      } else if (builder.state === 'returning') {
        builder.state = 'idle'
        builder.currentPosition = { ...this.builderHomePosition }
      }
    }
  }

  private updateSnapEffects(time: number): void {
    this.snapEffects = this.snapEffects.filter((effect) => {
      const elapsed = time - effect.startTime
      return elapsed < effect.duration
    })
  }

  private processQueue(time: number): void {
    if (this.builderAnimation.state !== 'idle') return
    if (this.pendingPlacements.length === 0) return

    const next = this.pendingPlacements[0]

    // Start builder walking to placement position
    this.builderAnimation = {
      startPosition: { ...this.builderAnimation.currentPosition },
      targetPosition: {
        x: Math.min(0.75, next.targetPosition.x + 0.1), // Stand next to target
        y: next.targetPosition.y,
      },
      currentPosition: { ...this.builderAnimation.currentPosition },
      progress: 0,
      duration: 500,
      startTime: time,
      state: 'walking',
      carryingPiece: next.pieceId,
    }
  }

  // ===========================================================================
  // EASING FUNCTIONS
  // ===========================================================================

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  private easeOutBack(t: number): number {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
}
