/**
 * Renderer
 *
 * Handles all canvas rendering for the construction visualization.
 * Supports pixel-perfect rendering with configurable scale.
 */

import type {
  Construction,
  ConstructionPiece,
  Connection,
  RenderState,
  BuilderState,
  Vec2,
  FrameEffect,
  ParticleConfig,
} from '../types'
import { EASING_FUNCTIONS } from '../constants'

// =============================================================================
// RENDERER
// =============================================================================

export interface RendererConfig {
  width: number
  height: number
  pixelScale: number
  backgroundColor: string
  palette: string[]
  showDebug?: boolean
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  pixelScale: number
  time: number
  deltaTime: number
}

export type PieceRenderer = (
  ctx: RenderContext,
  piece: ConstructionPiece,
  animationProgress: number
) => void

export type BuilderRenderer = (
  ctx: RenderContext,
  state: BuilderState,
  position: Vec2,
  animationProgress: number,
  bubble?: { text: string; style: 'working' | 'waiting' | 'done' | 'fading' } | null
) => void

export type ConnectionRenderer = (
  ctx: RenderContext,
  connection: Connection,
  fromPiece: ConstructionPiece,
  toPiece: ConstructionPiece
) => void

export type BatchConnectionRenderer = (
  ctx: RenderContext,
  construction: Construction
) => void

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: RendererConfig

  // Pluggable renderers (themes provide these)
  private pieceRenderer?: PieceRenderer
  private builderRenderer?: BuilderRenderer
  private connectionRenderer?: ConnectionRenderer
  private batchConnectionRenderer?: BatchConnectionRenderer

  // Effects state
  private particles: Particle[] = []
  private screenEffects: ActiveEffect[] = []

  constructor(canvas: HTMLCanvasElement, config: RendererConfig) {
    this.canvas = canvas
    this.config = config

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx

    // Set up canvas
    this.resize()

    // Disable image smoothing for pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  setPieceRenderer(renderer: PieceRenderer): void {
    this.pieceRenderer = renderer
  }

  setBuilderRenderer(renderer: BuilderRenderer): void {
    this.builderRenderer = renderer
  }

  setConnectionRenderer(renderer: ConnectionRenderer): void {
    this.connectionRenderer = renderer
  }

  setBatchConnectionRenderer(renderer: BatchConnectionRenderer): void {
    this.batchConnectionRenderer = renderer
  }

  resize(): void {
    const { width, height } = this.config

    // Set actual canvas size (internal resolution)
    this.canvas.width = width
    this.canvas.height = height

    // Don't set display size - let CSS handle responsive scaling
    // The component sets width: 100%, height: 100% for flexible sizing
    this.canvas.style.imageRendering = 'pixelated'
  }

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  render(state: RenderState): void {
    const ctx = this.ctx
    const { width, height } = this.config

    // Create render context
    const renderCtx: RenderContext = {
      ctx,
      width,
      height,
      pixelScale: this.config.pixelScale,
      time: state.time,
      deltaTime: state.deltaTime,
    }

    // Clear with background
    this.renderBackground(renderCtx)

    // Apply screen effects (pre)
    this.applyScreenEffectsPre(renderCtx)

    // Render connections (behind pieces)
    this.renderConnections(renderCtx, state.construction)

    // Render pieces
    this.renderPieces(renderCtx, state.construction, state.time)

    // Render builder
    if (this.builderRenderer) {
      this.builderRenderer(
        renderCtx,
        state.builder.state,
        state.builder.position,
        state.builder.animationProgress,
        state.builder.bubble
      )
    }

    // Render particles
    this.renderParticles(renderCtx, state.deltaTime)

    // Apply screen effects (post)
    this.applyScreenEffectsPost(renderCtx)

    // Debug overlay
    if (this.config.showDebug) {
      this.renderDebug(renderCtx, state)
    }
  }

  // ===========================================================================
  // BACKGROUND
  // ===========================================================================

  private renderBackground(ctx: RenderContext): void {
    ctx.ctx.fillStyle = this.config.backgroundColor
    ctx.ctx.fillRect(0, 0, ctx.width, ctx.height)
  }

  // ===========================================================================
  // PIECES
  // ===========================================================================

  private renderPieces(
    ctx: RenderContext,
    construction: Construction,
    _time: number
  ): void {
    // Sort by depth
    const sortedPieces = [...construction.pieces].sort(
      (a, b) => a.depth - b.depth
    )

    for (const piece of sortedPieces) {
      const animationProgress = piece.animationComplete ? 1 : 0

      if (this.pieceRenderer) {
        this.pieceRenderer(ctx, piece, animationProgress)
      } else {
        // Default piece rendering
        this.renderDefaultPiece(ctx, piece)
      }
    }
  }

  private renderDefaultPiece(ctx: RenderContext, piece: ConstructionPiece): void {
    const x = piece.position.x * ctx.width
    const y = piece.position.y * ctx.height
    const size = 8 * piece.size

    // Calculate pop-in animation based on piece age
    const age = Date.now() - piece.addedAt
    const animDuration = 300
    const t = Math.min(1, age / animDuration)
    const scale = t < 1 ? 1 - Math.pow(1 - t, 3) : 1

    if (scale <= 0) return

    ctx.ctx.save()
    ctx.ctx.translate(x, y)
    ctx.ctx.rotate(piece.rotation)
    ctx.ctx.scale(scale, scale)

    // Use palette color based on category hash
    const colorIndex = this.hashString(piece.category) % this.config.palette.length
    ctx.ctx.fillStyle = piece.color ?? this.config.palette[colorIndex]

    // Draw a simple shape based on variant
    switch (piece.variant % 4) {
      case 0: // Square
        ctx.ctx.fillRect(-size / 2, -size / 2, size, size)
        break
      case 1: // Circle
        ctx.ctx.beginPath()
        ctx.ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
        ctx.ctx.fill()
        break
      case 2: // Diamond
        ctx.ctx.beginPath()
        ctx.ctx.moveTo(0, -size / 2)
        ctx.ctx.lineTo(size / 2, 0)
        ctx.ctx.lineTo(0, size / 2)
        ctx.ctx.lineTo(-size / 2, 0)
        ctx.ctx.closePath()
        ctx.ctx.fill()
        break
      case 3: // Triangle
        ctx.ctx.beginPath()
        ctx.ctx.moveTo(0, -size / 2)
        ctx.ctx.lineTo(size / 2, size / 2)
        ctx.ctx.lineTo(-size / 2, size / 2)
        ctx.ctx.closePath()
        ctx.ctx.fill()
        break
    }

    ctx.ctx.restore()
  }

  // ===========================================================================
  // CONNECTIONS
  // ===========================================================================

  private renderConnections(
    ctx: RenderContext,
    construction: Construction
  ): void {
    // Use batch renderer if available (themes can render all connections at once)
    if (this.batchConnectionRenderer) {
      this.batchConnectionRenderer(ctx, construction)
      return
    }

    // Otherwise render individual connections
    const pieceMap = new Map(construction.pieces.map((p) => [p.id, p]))

    for (const connection of construction.connections) {
      if (!connection.visualized) continue

      const fromPiece = pieceMap.get(connection.from)
      const toPiece = pieceMap.get(connection.to)

      if (!fromPiece || !toPiece) continue

      if (this.connectionRenderer) {
        this.connectionRenderer(ctx, connection, fromPiece, toPiece)
      } else {
        this.renderDefaultConnection(ctx, fromPiece, toPiece)
      }
    }
  }

  private renderDefaultConnection(
    ctx: RenderContext,
    from: ConstructionPiece,
    to: ConstructionPiece
  ): void {
    const x1 = from.position.x * ctx.width
    const y1 = from.position.y * ctx.height
    const x2 = to.position.x * ctx.width
    const y2 = to.position.y * ctx.height

    ctx.ctx.strokeStyle = this.config.palette[0]
    ctx.ctx.lineWidth = 1
    ctx.ctx.globalAlpha = 0.3

    ctx.ctx.beginPath()
    ctx.ctx.moveTo(x1, y1)
    ctx.ctx.lineTo(x2, y2)
    ctx.ctx.stroke()

    ctx.ctx.globalAlpha = 1
  }

  // ===========================================================================
  // PARTICLES
  // ===========================================================================

  spawnParticles(config: ParticleConfig): void {
    const colors = config.colors ?? this.config.palette.slice(0, 5)

    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 2

      this.particles.push({
        x: config.position.x,
        y: config.position.y,
        vx: Math.cos(angle) * speed * config.spread,
        vy: Math.sin(angle) * speed * config.spread - 1, // Upward bias
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
        life: 1,
        decay: 1 / (config.duration / 16), // Assuming 60fps
        type: config.type,
      })
    }
  }

  private renderParticles(ctx: RenderContext, deltaTime: number): void {
    const gravity = 0.05
    const dt = deltaTime / 16 // Normalize to 60fps

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]

      // Update
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += gravity * dt
      p.life -= p.decay * dt

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      // Render
      const x = p.x * ctx.width
      const y = p.y * ctx.height

      ctx.ctx.globalAlpha = p.life
      ctx.ctx.fillStyle = p.color

      if (p.type === 'confetti') {
        ctx.ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size * 0.6)
      } else if (p.type === 'sparks') {
        ctx.ctx.fillRect(x, y, 2, 2)
      } else {
        ctx.ctx.beginPath()
        ctx.ctx.arc(x, y, p.size / 2, 0, Math.PI * 2)
        ctx.ctx.fill()
      }

      ctx.ctx.globalAlpha = 1
    }
  }

  // ===========================================================================
  // SCREEN EFFECTS
  // ===========================================================================

  addScreenEffect(effect: FrameEffect): void {
    this.screenEffects.push({
      ...effect,
      startTime: performance.now(),
      progress: 0,
    })
  }

  private applyScreenEffectsPre(ctx: RenderContext): void {
    for (const effect of this.screenEffects) {
      if (effect.type === 'shake') {
        const offsetX = (Math.random() - 0.5) * effect.intensity * 10
        const offsetY = (Math.random() - 0.5) * effect.intensity * 10
        ctx.ctx.translate(offsetX, offsetY)
      }
    }
  }

  private applyScreenEffectsPost(ctx: RenderContext): void {
    const now = performance.now()

    for (let i = this.screenEffects.length - 1; i >= 0; i--) {
      const effect = this.screenEffects[i]
      const elapsed = now - effect.startTime
      const duration = effect.duration ?? 500

      effect.progress = Math.min(1, elapsed / duration)

      if (effect.type === 'flash') {
        const alpha = effect.intensity * (1 - effect.progress)
        ctx.ctx.fillStyle = effect.color ?? '#ffffff'
        ctx.ctx.globalAlpha = alpha
        ctx.ctx.fillRect(0, 0, ctx.width, ctx.height)
        ctx.ctx.globalAlpha = 1
      } else if (effect.type === 'scanlines') {
        ctx.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
        for (let y = 0; y < ctx.height; y += 2) {
          ctx.ctx.fillRect(0, y, ctx.width, 1)
        }
      }

      // Remove completed effects
      if (effect.progress >= 1) {
        this.screenEffects.splice(i, 1)
      }
    }

    // Reset transform if shake was applied
    ctx.ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  // ===========================================================================
  // DEBUG
  // ===========================================================================

  private renderDebug(ctx: RenderContext, state: RenderState): void {
    ctx.ctx.fillStyle = '#00ff00'
    ctx.ctx.font = '8px monospace'

    const lines = [
      `Phase: ${state.construction.phase}`,
      `Pieces: ${state.construction.pieces.length}`,
      `Progress: ${(state.construction.progress * 100).toFixed(1)}%`,
      `Builder: ${state.builder.state}`,
      `Queue: ${state.animationQueue.length}`,
    ]

    lines.forEach((line, i) => {
      ctx.ctx.fillText(line, 4, 10 + i * 10)
    })

    // Draw center of mass
    const com = state.construction.centerOfMass
    ctx.ctx.fillStyle = '#ff0000'
    ctx.ctx.fillRect(com.x * ctx.width - 2, com.y * ctx.height - 2, 4, 4)

    // Draw bounds
    const { min, max } = state.construction.bounds
    ctx.ctx.strokeStyle = '#ffff00'
    ctx.ctx.lineWidth = 1
    ctx.ctx.strokeRect(
      min.x * ctx.width,
      min.y * ctx.height,
      (max.x - min.x) * ctx.width,
      (max.y - min.y) * ctx.height
    )
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  /**
   * Draw a pixel-perfect rectangle
   */
  drawPixelRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h))
  }

  /**
   * Draw pixel-perfect line
   */
  drawPixelLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string
  ): void {
    // Bresenham's line algorithm for pixel-perfect lines
    x1 = Math.floor(x1)
    y1 = Math.floor(y1)
    x2 = Math.floor(x2)
    y2 = Math.floor(y2)

    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx - dy

    this.ctx.fillStyle = color

    while (true) {
      this.ctx.fillRect(x1, y1, 1, 1)

      if (x1 === x2 && y1 === y2) break

      const e2 = 2 * err

      if (e2 > -dy) {
        err -= dy
        x1 += sx
      }

      if (e2 < dx) {
        err += dx
        y1 += sy
      }
    }
  }

  /**
   * Get canvas data URL
   */
  toDataURL(type = 'image/png'): string {
    return this.canvas.toDataURL(type)
  }

  /**
   * Get canvas blob
   */
  toBlob(type = 'image/png'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create blob'))
        },
        type
      )
    })
  }
}

// =============================================================================
// TYPES
// =============================================================================

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
  decay: number
  type: ParticleConfig['type']
}

interface ActiveEffect extends FrameEffect {
  startTime: number
  progress: number
}

// =============================================================================
// FACTORY
// =============================================================================

export function createRenderer(
  canvas: HTMLCanvasElement,
  config: RendererConfig
): Renderer {
  return new Renderer(canvas, config)
}
