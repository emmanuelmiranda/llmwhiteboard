/**
 * Painter Theme
 *
 * A character-based theme featuring a pixel artist.
 * Pieces are brush strokes that connect and blend together to form a painting.
 * The painting grows organically from a central point.
 */

import { BaseTheme, registerTheme } from '../base-theme'
import type {
  Construction,
  ConstructionPiece,
  ThemeManifest,
  AnimationSequence,
  BuilderState,
  Vec2,
  MergeStyle,
  PlacementStrategy,
} from '../../types'
import type { RenderContext } from '../../core/Renderer'

// =============================================================================
// PAINTER THEME
// =============================================================================

export class PainterTheme extends BaseTheme {
  readonly manifest: ThemeManifest = {
    id: 'painter',
    name: 'Pixel Painter',
    description: 'Watch a painting come to life stroke by stroke',
    author: 'Pixel Progress',
    version: '1.0.0',
    dimensions: { width: 160, height: 90 },
    backgroundColor: '#1a1423',
    pixelScale: 4,
    palette: [
      '#ff6b6b', // Red
      '#4ecdc4', // Teal
      '#ffe66d', // Yellow
      '#95e1d3', // Mint
      '#f38181', // Coral
      '#aa96da', // Lavender
      '#fcbad3', // Pink
      '#a8d8ea', // Sky blue
      '#ffb347', // Orange
      '#98d8c8', // Seafoam
    ],
    categories: [
      { id: 'start', name: 'Setup', description: 'Canvas preparation', behavior: 'piece', pieceVariants: 1 },
      { id: 'create', name: 'Stroke', description: 'New brush stroke', behavior: 'piece', pieceVariants: 6 },
      { id: 'modify', name: 'Touch-up', description: 'Refine existing', behavior: 'modifier', pieceVariants: 4 },
      { id: 'execute', name: 'Detail', description: 'Add detail', behavior: 'piece', pieceVariants: 4 },
      { id: 'search', name: 'Study', description: 'Examine canvas', behavior: 'animation' },
      { id: 'analyze', name: 'Think', description: 'Plan next stroke', behavior: 'animation' },
      { id: 'wait', name: 'Wait', description: 'Waiting for inspiration', behavior: 'animation' },
      { id: 'input', name: 'Inspire', description: 'Receive inspiration', behavior: 'animation' },
      { id: 'error', name: 'Mistake', description: 'Oops!', behavior: 'animation' },
      { id: 'end', name: 'Sign', description: 'Sign the painting', behavior: 'animation' },
    ],
    builderType: 'character',
    placementStrategy: 'organic',
  }

  constructor() {
    super()
  }

  async load(): Promise<void> {
    // No external assets needed - all procedural
  }

  getPlacementStrategy(): PlacementStrategy {
    return 'organic'
  }

  getDefaultMergeStyle(): MergeStyle {
    return 'blend'
  }

  // ===========================================================================
  // PIECE RENDERING - The actual painting being built
  // ===========================================================================

  renderPiece = (
    ctx: RenderContext,
    piece: ConstructionPiece,
    _animationProgress: number
  ): void => {
    // Paint area is the left 70% of canvas (painter on right)
    const paintAreaWidth = ctx.width * 0.7
    const paintAreaX = ctx.width * 0.05
    const paintAreaY = ctx.height * 0.1
    const paintAreaHeight = ctx.height * 0.8

    // Map piece position to paint area
    const x = paintAreaX + piece.position.x * paintAreaWidth
    const y = paintAreaY + piece.position.y * paintAreaHeight

    // Calculate pop-in animation
    const age = Date.now() - piece.addedAt
    const animDuration = 400
    const t = Math.min(1, age / animDuration)
    const scale = t < 1 ? this.easeOutBack(t) : 1

    if (scale <= 0.01) return

    ctx.ctx.save()
    ctx.ctx.translate(x, y)
    ctx.ctx.rotate(piece.rotation)
    ctx.ctx.scale(scale * piece.size, scale * piece.size)

    // Get color
    const color = piece.color ?? this.getPieceColor(piece.category, piece.variant)

    // Draw the stroke - different shapes based on variant
    this.drawStroke(ctx.ctx, piece.variant, color)

    ctx.ctx.restore()
  }

  private drawStroke(ctx: CanvasRenderingContext2D, variant: number, color: string): void {
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9

    const v = variant % 6

    switch (v) {
      case 0: // Horizontal blob
        this.drawBlob(ctx, 12, 5)
        break
      case 1: // Vertical blob
        this.drawBlob(ctx, 5, 10)
        break
      case 2: // Round dab
        this.drawDab(ctx, 6)
        break
      case 3: // Diagonal stroke
        ctx.rotate(Math.PI / 4)
        this.drawBlob(ctx, 10, 4)
        break
      case 4: // Wide stroke
        this.drawBlob(ctx, 14, 6)
        break
      case 5: // Small accent
        this.drawDab(ctx, 4)
        break
    }

    ctx.globalAlpha = 1
  }

  private drawBlob(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Organic blob shape
    ctx.beginPath()
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()

    // Add some texture with smaller overlapping circles
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.ellipse(-w * 0.2, -h * 0.1, w * 0.3, h * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(w * 0.15, h * 0.1, w * 0.25, h * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawDab(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.beginPath()
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // ===========================================================================
  // RENDER CONNECTIONS - Paint strokes blend together
  // ===========================================================================

  renderConnections(ctx: RenderContext, construction: Construction): void {
    if (construction.pieces.length < 2) return

    const paintAreaWidth = ctx.width * 0.7
    const paintAreaX = ctx.width * 0.05
    const paintAreaY = ctx.height * 0.1
    const paintAreaHeight = ctx.height * 0.8

    ctx.ctx.globalAlpha = 0.3
    ctx.ctx.lineWidth = 3
    ctx.ctx.lineCap = 'round'

    // Draw soft connections between nearby pieces
    for (let i = 1; i < construction.pieces.length; i++) {
      const piece = construction.pieces[i]
      const prevPiece = construction.pieces[i - 1]

      const x1 = paintAreaX + prevPiece.position.x * paintAreaWidth
      const y1 = paintAreaY + prevPiece.position.y * paintAreaHeight
      const x2 = paintAreaX + piece.position.x * paintAreaWidth
      const y2 = paintAreaY + piece.position.y * paintAreaHeight

      // Only connect if pieces are relatively close
      const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
      if (dist < 40) {
        const color = piece.color ?? this.getPieceColor(piece.category, piece.variant)
        ctx.ctx.strokeStyle = color

        ctx.ctx.beginPath()
        ctx.ctx.moveTo(x1, y1)
        // Curved connection
        const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 10
        const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 10
        ctx.ctx.quadraticCurveTo(midX, midY, x2, y2)
        ctx.ctx.stroke()
      }
    }

    ctx.ctx.globalAlpha = 1
  }

  // ===========================================================================
  // BUILDER RENDERING - The painter character on the side
  // ===========================================================================

  renderBuilder = (
    ctx: RenderContext,
    state: BuilderState,
    position: Vec2,
    _animationProgress: number
  ): void => {
    // Painter is positioned on the right side
    const x = ctx.width * 0.85
    const y = ctx.height * 0.65

    ctx.ctx.save()
    ctx.ctx.translate(x, y)

    this.drawPainter(ctx.ctx, state, ctx.time)

    ctx.ctx.restore()
  }

  private drawPainter(
    ctx: CanvasRenderingContext2D,
    state: BuilderState,
    time: number
  ): void {
    // Animation parameters based on state
    let headBob = 0
    let armAngle = 0
    let bodyLean = 0

    switch (state) {
      case 'working':
        armAngle = Math.sin(time / 100) * 0.4
        headBob = Math.abs(Math.sin(time / 150))
        break
      case 'waiting':
        headBob = Math.sin(time / 300) * 2
        bodyLean = Math.sin(time / 500) * 0.05
        break
      case 'searching':
        headBob = Math.sin(time / 200) * 1.5
        bodyLean = Math.sin(time / 400) * 0.1
        break
      case 'thinking':
        headBob = Math.sin(time / 400) * 0.5
        break
      case 'frustrated':
        headBob = Math.sin(time / 80) * 2
        break
      case 'celebrating':
        headBob = Math.abs(Math.sin(time / 100)) * 3
        armAngle = Math.sin(time / 150) * 0.6
        break
      case 'receiving':
        headBob = 1
        break
    }

    ctx.save()
    ctx.rotate(bodyLean)

    // Scale down the painter a bit
    ctx.scale(0.8, 0.8)

    // Colors
    const skinColor = '#f4d9a8'
    const shirtColor = '#5c6bc0'
    const pantsColor = '#37474f'
    const hairColor = '#4a3728'
    const beretColor = '#c62828'

    // Legs
    ctx.fillStyle = pantsColor
    ctx.fillRect(-4, 8, 3, 8)
    ctx.fillRect(1, 8, 3, 8)

    // Body
    ctx.fillStyle = shirtColor
    ctx.fillRect(-5, 0, 10, 10)

    // Painting arm (extended towards canvas)
    ctx.save()
    ctx.translate(-5, 3)
    ctx.rotate(-0.8 + armAngle)
    ctx.fillStyle = shirtColor
    ctx.fillRect(-12, -1, 12, 3)
    // Hand
    ctx.fillStyle = skinColor
    ctx.fillRect(-15, -1, 4, 3)
    // Brush
    ctx.fillStyle = '#8d6e63'
    ctx.fillRect(-20, -1, 5, 2)
    // Brush tip with current color
    const brushColor = this.manifest.palette[Math.floor(time / 800) % this.manifest.palette.length]
    ctx.fillStyle = brushColor
    ctx.fillRect(-23, -2, 4, 4)
    ctx.restore()

    // Other arm (holding palette, closer to body)
    ctx.save()
    ctx.translate(5, 3)
    ctx.rotate(0.3)
    ctx.fillStyle = shirtColor
    ctx.fillRect(0, -1, 6, 3)
    ctx.fillStyle = skinColor
    ctx.fillRect(5, -1, 3, 3)
    // Small palette
    ctx.fillStyle = '#d7ccc8'
    ctx.beginPath()
    ctx.ellipse(10, 1, 4, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Head
    ctx.fillStyle = skinColor
    ctx.fillRect(-4, -10 + headBob, 8, 8)

    // Hair
    ctx.fillStyle = hairColor
    ctx.fillRect(-4, -12 + headBob, 8, 3)

    // Beret
    ctx.fillStyle = beretColor
    ctx.fillRect(-5, -13 + headBob, 10, 3)
    ctx.fillRect(-3, -14 + headBob, 6, 2)

    // Eyes
    ctx.fillStyle = '#333'
    if (state === 'frustrated') {
      ctx.fillRect(-3, -7 + headBob, 2, 1)
      ctx.fillRect(1, -7 + headBob, 2, 1)
    } else if (state === 'celebrating') {
      ctx.fillRect(-3, -6 + headBob, 2, 1)
      ctx.fillRect(1, -6 + headBob, 2, 1)
    } else {
      ctx.fillRect(-3, -6 + headBob, 2, 2)
      ctx.fillRect(1, -6 + headBob, 2, 2)
    }

    // State-specific extras
    if (state === 'waiting') {
      // Tapping foot
      const footTap = Math.sin(time / 100) > 0 ? 1 : 0
      ctx.fillStyle = pantsColor
      ctx.fillRect(-4, 15 + footTap, 3, 1)
    }

    if (state === 'thinking') {
      // Thought bubble
      ctx.fillStyle = '#fff'
      ctx.globalAlpha = 0.7
      ctx.fillRect(8, -18 + headBob, 2, 2)
      ctx.fillRect(11, -22 + headBob, 3, 3)
      ctx.fillRect(15, -27 + headBob, 5, 5)
      ctx.globalAlpha = 1
    }

    ctx.restore()
  }

  // ===========================================================================
  // ANIMATIONS
  // ===========================================================================

  getPieceAddAnimation(piece: ConstructionPiece): AnimationSequence {
    return {
      id: `add-${piece.id}`,
      keyframes: [
        { time: 0, scale: 0, opacity: 0 },
        { time: 0.5, scale: 1.1, opacity: 1 },
        { time: 1, scale: 1, opacity: 1 },
      ],
      duration: 400,
      easing: 'ease-out',
      loop: false,
    }
  }

  getCompletionAnimation(construction: Construction): AnimationSequence {
    return {
      id: 'completion',
      keyframes: [
        { time: 0, effects: [{ type: 'flash', intensity: 0.3, color: '#fff' }] },
        { time: 0.5, effects: [{ type: 'particles', intensity: 1 }] },
        { time: 1 },
      ],
      duration: 2000,
      easing: 'ease-out',
      loop: false,
    }
  }

  getBuilderWorkPosition(_construction: Construction): Vec2 {
    return { x: 0.85, y: 0.6 }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private easeOutBack(t: number): number {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
}

// =============================================================================
// REGISTER
// =============================================================================

registerTheme('painter', () => new PainterTheme())

export default PainterTheme
