/**
 * Garden Theme
 *
 * A nature-inspired theme where events grow as plants in a garden.
 * Features a gardener character who tends to the growing plants.
 */

import { BaseTheme, registerTheme } from '../base-theme'
import type {
  Construction,
  ConstructionPiece,
  ThemeManifest,
  AnimationSequence,
  BuilderState,
  Vec2,
} from '../../types'
import type { RenderContext } from '../../core/Renderer'

// =============================================================================
// CONSTANTS
// =============================================================================

// Plant types by category
const PLANT_TYPES: Record<string, PlantType> = {
  start: 'sunflower',
  create: 'flower',
  modify: 'fern',
  execute: 'tree',
  search: 'mushroom',
  analyze: 'succulent',
  process: 'wheat',
  wait: 'seedling',
  input: 'tulip',
  error: 'deadPlant',
  success: 'rose',
  end: 'cherry_blossom',
  default: 'flower',
}

type PlantType = 'sunflower' | 'flower' | 'fern' | 'tree' | 'mushroom' | 'succulent' | 'wheat' | 'seedling' | 'tulip' | 'deadPlant' | 'rose' | 'cherry_blossom'

// Color palettes for plants
const PLANT_COLORS: Record<PlantType, { stem: string; bloom: string; accent: string }> = {
  sunflower: { stem: '#228B22', bloom: '#FFD700', accent: '#8B4513' },
  flower: { stem: '#2E8B57', bloom: '#FF69B4', accent: '#FFB6C1' },
  fern: { stem: '#006400', bloom: '#32CD32', accent: '#90EE90' },
  tree: { stem: '#8B4513', bloom: '#228B22', accent: '#90EE90' },
  mushroom: { stem: '#DEB887', bloom: '#DC143C', accent: '#FFFAF0' },
  succulent: { stem: '#3CB371', bloom: '#98FB98', accent: '#2E8B57' },
  wheat: { stem: '#DAA520', bloom: '#F4A460', accent: '#FFE4B5' },
  seedling: { stem: '#228B22', bloom: '#90EE90', accent: '#98FB98' },
  tulip: { stem: '#228B22', bloom: '#FF6347', accent: '#FF4500' },
  deadPlant: { stem: '#696969', bloom: '#808080', accent: '#A9A9A9' },
  rose: { stem: '#228B22', bloom: '#FF0000', accent: '#8B0000' },
  cherry_blossom: { stem: '#8B4513', bloom: '#FFB7C5', accent: '#FFC0CB' },
}

// Ground level and layout
const GROUND_Y = 0.85
const SOIL_HEIGHT = 0.15
const PLANT_AREA_START = 0.05
const PLANT_AREA_END = 0.70

// =============================================================================
// GARDEN THEME
// =============================================================================

export class GardenTheme extends BaseTheme {
  readonly manifest: ThemeManifest = {
    id: 'garden',
    name: 'Zen Garden',
    description: 'Watch your progress bloom in a peaceful garden',
    author: 'Pixel Progress',
    version: '1.0.0',
    dimensions: { width: 160, height: 100 },
    backgroundColor: '#87CEEB', // Sky blue
    pixelScale: 4,
    palette: [
      '#228B22', '#32CD32', '#90EE90', // Greens
      '#FF69B4', '#FFD700', '#FF6347', // Flowers
      '#8B4513', '#DEB887', '#F4A460', // Earth tones
      '#DC143C', '#FF0000', '#FFB7C5', // Reds/pinks
    ],
    categories: [
      { id: 'start', name: 'Sunflower', description: 'Starting seed', behavior: 'piece', pieceVariants: 1 },
      { id: 'create', name: 'Flower', description: 'New bloom', behavior: 'piece', pieceVariants: 4 },
      { id: 'modify', name: 'Fern', description: 'Growing fern', behavior: 'piece', pieceVariants: 3 },
      { id: 'execute', name: 'Tree', description: 'Strong tree', behavior: 'piece', pieceVariants: 2 },
      { id: 'search', name: 'Mushroom', description: 'Forest find', behavior: 'piece', pieceVariants: 3 },
      { id: 'analyze', name: 'Succulent', description: 'Thoughtful growth', behavior: 'piece', pieceVariants: 2 },
      { id: 'process', name: 'Wheat', description: 'Processing grain', behavior: 'piece', pieceVariants: 2 },
      { id: 'wait', name: 'Seedling', description: 'Waiting to grow', behavior: 'animation' },
      { id: 'input', name: 'Tulip', description: 'User input', behavior: 'piece', pieceVariants: 3 },
      { id: 'error', name: 'Wilted', description: 'Something wilted', behavior: 'piece', pieceVariants: 1 },
      { id: 'success', name: 'Rose', description: 'Success bloom', behavior: 'piece', pieceVariants: 2 },
      { id: 'end', name: 'Cherry Blossom', description: 'Beautiful ending', behavior: 'animation' },
    ],
    builderType: 'character',
    placementStrategy: 'gravity',
  }

  // Track planted positions to avoid overlap
  private plantedPositions: Array<{ x: number; plantId: string }> = []
  private nextPlantX: number = PLANT_AREA_START

  // Ambient elements
  private butterflies: Array<{ x: number; y: number; phase: number; color: string }> = []
  private lastButterflySpawn: number = 0

  // Gardener animation variant
  private gardenerAction: 'watering' | 'planting' | 'admiring' | 'digging' = 'watering'
  private lastActionChange: number = 0
  private readonly ACTION_CYCLE_TIME = 3500

  constructor() {
    super()
    this.initButterflies()
  }

  private initButterflies(): void {
    // Start with a few butterflies
    const colors = ['#FFB6C1', '#DDA0DD', '#87CEFA', '#FFFACD']
    for (let i = 0; i < 3; i++) {
      this.butterflies.push({
        x: Math.random() * 0.8 + 0.1,
        y: Math.random() * 0.4 + 0.2,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
      })
    }
  }

  async load(): Promise<void> {
    // Procedural theme - no assets to load
  }

  onReset(): void {
    this.plantedPositions = []
    this.nextPlantX = PLANT_AREA_START
    this.initButterflies()
  }

  // ===========================================================================
  // PIECE RENDERING - Plants
  // ===========================================================================

  renderPiece = (
    ctx: RenderContext,
    piece: ConstructionPiece,
    animationProgress: number
  ): void => {
    const plantType = PLANT_TYPES[piece.category] || PLANT_TYPES.default
    const colors = PLANT_COLORS[plantType]

    // Growth animation - plants grow from ground up
    // Use animationProgress directly, default to 1 (fully grown) if animation complete
    const progress = animationProgress > 0 ? animationProgress : 1
    const growthScale = this.easeOutBack(Math.min(progress * 1.2, 1))

    // Use piece position for X, always plant at ground level for Y
    const x = piece.position.x * ctx.width
    const baseY = GROUND_Y * ctx.height

    ctx.ctx.save()
    ctx.ctx.translate(x, baseY)

    // Draw soil mound at base of each plant
    ctx.ctx.fillStyle = '#6B4423'
    ctx.ctx.beginPath()
    ctx.ctx.ellipse(0, 2, 6, 3, 0, 0, Math.PI * 2)
    ctx.ctx.fill()

    // Gentle swaying in the breeze
    const swayAngle = Math.sin(ctx.time / 800 + piece.position.x * 10) * 0.03
    ctx.ctx.rotate(swayAngle)

    // Scale for growth animation (Y axis grows up from ground)
    ctx.ctx.scale(1, growthScale)

    // Ensure piece has a valid size
    const size = piece.size || 1

    this.drawPlant(ctx.ctx, plantType, colors, size, piece.variant || 0, ctx.time)

    ctx.ctx.restore()
  }

  private drawPlant(
    ctx: CanvasRenderingContext2D,
    type: PlantType,
    colors: { stem: string; bloom: string; accent: string },
    size: number,
    variant: number,
    time: number
  ): void {
    const scale = 0.8 + size * 0.4

    switch (type) {
      case 'sunflower':
        this.drawSunflower(ctx, colors, scale, time)
        break
      case 'flower':
        this.drawFlower(ctx, colors, scale, variant, time)
        break
      case 'fern':
        this.drawFern(ctx, colors, scale, time)
        break
      case 'tree':
        this.drawTree(ctx, colors, scale, time)
        break
      case 'mushroom':
        this.drawMushroom(ctx, colors, scale, variant)
        break
      case 'succulent':
        this.drawSucculent(ctx, colors, scale)
        break
      case 'wheat':
        this.drawWheat(ctx, colors, scale, time)
        break
      case 'seedling':
        this.drawSeedling(ctx, colors, scale, time)
        break
      case 'tulip':
        this.drawTulip(ctx, colors, scale, variant)
        break
      case 'deadPlant':
        this.drawDeadPlant(ctx, colors, scale)
        break
      case 'rose':
        this.drawRose(ctx, colors, scale, time)
        break
      case 'cherry_blossom':
        this.drawCherryBlossom(ctx, colors, scale, time)
        break
    }
  }

  private drawSunflower(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 35 * scale

    // Stem
    ctx.fillStyle = colors.stem
    ctx.fillRect(-2, -height, 4, height)

    // Leaves on stem
    ctx.beginPath()
    ctx.ellipse(-6, -height * 0.4, 8, 4, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(6, -height * 0.6, 8, 4, 0.3, 0, Math.PI * 2)
    ctx.fill()

    // Flower head - petals
    const petalCount = 12
    ctx.fillStyle = colors.bloom
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2 + Math.sin(time / 1000) * 0.1
      ctx.save()
      ctx.translate(0, -height)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.ellipse(0, -10, 3, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Center
    ctx.fillStyle = colors.accent
    ctx.beginPath()
    ctx.arc(0, -height, 6, 0, Math.PI * 2)
    ctx.fill()

    // Seeds pattern in center
    ctx.fillStyle = '#4a3728'
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(-4 + i * 2, -height - 4 + j * 2, 1, 1)
        }
      }
    }
  }

  private drawFlower(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, variant: number, time: number): void {
    const height = 20 * scale

    // Stem
    ctx.fillStyle = colors.stem
    ctx.fillRect(-1, -height, 2, height)

    // Small leaf
    ctx.beginPath()
    ctx.ellipse(4, -height * 0.5, 5, 3, 0.4, 0, Math.PI * 2)
    ctx.fill()

    // Flower petals - different styles based on variant
    const petalCount = 5 + (variant % 3)
    ctx.fillStyle = colors.bloom

    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2
      ctx.save()
      ctx.translate(0, -height)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.ellipse(0, -5, 2.5, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Center
    ctx.fillStyle = colors.accent
    ctx.beginPath()
    ctx.arc(0, -height, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawFern(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 25 * scale

    // Main stem
    ctx.strokeStyle = colors.stem
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(2, -height * 0.5, 0, -height)
    ctx.stroke()

    // Fronds
    ctx.fillStyle = colors.bloom
    const frondCount = 6
    for (let i = 0; i < frondCount; i++) {
      const y = -height * 0.2 - (i * height * 0.12)
      const side = i % 2 === 0 ? 1 : -1
      const frondLength = 8 - i * 0.5

      ctx.save()
      ctx.translate(0, y)
      ctx.rotate(side * 0.6)

      // Draw frond with leaflets
      for (let j = 0; j < 4; j++) {
        const lx = j * frondLength / 4
        const ly = -2 + Math.abs(j - 2) * 0.5
        ctx.beginPath()
        ctx.ellipse(lx, ly, 2, 4, side * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 40 * scale

    // Trunk
    ctx.fillStyle = colors.stem
    ctx.fillRect(-3, -height * 0.4, 6, height * 0.4)

    // Tree crown - layered circles
    ctx.fillStyle = colors.bloom
    const layers = [
      { y: -height * 0.5, r: 12 },
      { y: -height * 0.65, r: 10 },
      { y: -height * 0.8, r: 8 },
      { y: -height * 0.9, r: 5 },
    ]

    for (const layer of layers) {
      ctx.beginPath()
      ctx.arc(0, layer.y * scale, layer.r * scale * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }

    // Highlight
    ctx.fillStyle = colors.accent
    ctx.beginPath()
    ctx.arc(-3, -height * 0.6, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawMushroom(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, variant: number): void {
    const height = 12 * scale

    // Stem
    ctx.fillStyle = colors.stem
    ctx.fillRect(-3, -height * 0.6, 6, height * 0.6)

    // Cap
    ctx.fillStyle = colors.bloom
    ctx.beginPath()
    ctx.ellipse(0, -height * 0.6, 10 * scale, 6 * scale, 0, Math.PI, 0)
    ctx.fill()

    // Spots
    ctx.fillStyle = colors.accent
    const spotCount = 2 + variant
    for (let i = 0; i < spotCount; i++) {
      const angle = (i / spotCount) * Math.PI - Math.PI / 2
      const sx = Math.cos(angle) * 5 * scale
      const sy = -height * 0.7 + Math.sin(angle) * 2 * scale
      ctx.beginPath()
      ctx.arc(sx, sy, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawSucculent(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number): void {
    // Rosette pattern
    const layers = 3
    for (let layer = layers - 1; layer >= 0; layer--) {
      const petalCount = 6 + layer * 2
      const radius = (4 + layer * 3) * scale

      ctx.fillStyle = layer === 0 ? colors.accent : colors.bloom

      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2 + layer * 0.2
        ctx.save()
        ctx.translate(0, -8 * scale)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.ellipse(0, -radius * 0.5, 3 * scale, radius * 0.6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  private drawWheat(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 28 * scale
    const sway = Math.sin(time / 600) * 0.1

    // Multiple stalks
    for (let s = -1; s <= 1; s++) {
      ctx.save()
      ctx.translate(s * 3, 0)
      ctx.rotate(sway + s * 0.1)

      // Stalk
      ctx.strokeStyle = colors.stem
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -height)
      ctx.stroke()

      // Wheat head
      ctx.fillStyle = colors.bloom
      for (let i = 0; i < 6; i++) {
        const y = -height + i * 2.5
        const side = i % 2 === 0 ? 1 : -1
        ctx.beginPath()
        ctx.ellipse(side * 2, y, 2, 4, side * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }
  }

  private drawSeedling(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 8 * scale
    const wobble = Math.sin(time / 400) * 0.15

    ctx.save()
    ctx.rotate(wobble)

    // Tiny stem
    ctx.fillStyle = colors.stem
    ctx.fillRect(-1, -height, 2, height)

    // Two small leaves
    ctx.fillStyle = colors.bloom
    ctx.beginPath()
    ctx.ellipse(-4, -height, 4, 3, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(4, -height, 4, 3, 0.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  private drawTulip(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, variant: number): void {
    const height = 22 * scale

    // Stem
    ctx.fillStyle = colors.stem
    ctx.fillRect(-1, -height, 2, height)

    // Long leaf
    ctx.beginPath()
    ctx.moveTo(0, -2)
    ctx.quadraticCurveTo(8, -height * 0.4, 2, -height * 0.6)
    ctx.quadraticCurveTo(4, -height * 0.3, 0, -2)
    ctx.fill()

    // Tulip cup
    ctx.fillStyle = colors.bloom
    ctx.beginPath()
    ctx.moveTo(-5, -height)
    ctx.quadraticCurveTo(-6, -height - 8, 0, -height - 10)
    ctx.quadraticCurveTo(6, -height - 8, 5, -height)
    ctx.quadraticCurveTo(0, -height + 2, -5, -height)
    ctx.fill()

    // Inner highlight
    ctx.fillStyle = colors.accent
    ctx.beginPath()
    ctx.moveTo(-2, -height)
    ctx.quadraticCurveTo(-2, -height - 5, 0, -height - 6)
    ctx.quadraticCurveTo(2, -height - 5, 2, -height)
    ctx.fill()
  }

  private drawDeadPlant(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number): void {
    const height = 15 * scale

    // Droopy stem
    ctx.strokeStyle = colors.stem
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(5, -height * 0.5, 8, -height * 0.7)
    ctx.stroke()

    // Wilted leaves
    ctx.fillStyle = colors.bloom
    ctx.beginPath()
    ctx.ellipse(10, -height * 0.7, 5, 3, 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(6, -height * 0.5, 4, 2, 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawRose(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 25 * scale

    // Stem with thorns
    ctx.fillStyle = colors.stem
    ctx.fillRect(-1, -height, 2, height)

    // Thorns
    for (let i = 0; i < 3; i++) {
      const y = -5 - i * 6
      ctx.beginPath()
      ctx.moveTo(1, y)
      ctx.lineTo(4, y - 2)
      ctx.lineTo(1, y - 1)
      ctx.fill()
    }

    // Rose bloom - spiral petals
    ctx.fillStyle = colors.bloom
    const petalLayers = 3
    for (let layer = petalLayers - 1; layer >= 0; layer--) {
      const petalCount = 5
      const radius = (3 + layer * 2) * scale

      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2 + layer * 0.3
        ctx.save()
        ctx.translate(0, -height)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.ellipse(0, -radius * 0.4, 3, radius * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // Dark center
    ctx.fillStyle = colors.accent
    ctx.beginPath()
    ctx.arc(0, -height, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawCherryBlossom(ctx: CanvasRenderingContext2D, colors: { stem: string; bloom: string; accent: string }, scale: number, time: number): void {
    const height = 35 * scale

    // Branch/trunk
    ctx.fillStyle = colors.stem
    ctx.fillRect(-3, -height * 0.3, 6, height * 0.3)

    // Branches
    ctx.strokeStyle = colors.stem
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, -height * 0.3)
    ctx.quadraticCurveTo(-15, -height * 0.5, -20, -height * 0.7)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -height * 0.3)
    ctx.quadraticCurveTo(15, -height * 0.6, 18, -height * 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -height * 0.3)
    ctx.quadraticCurveTo(0, -height * 0.6, -5, -height * 0.9)
    ctx.stroke()

    // Blossoms scattered along branches
    ctx.fillStyle = colors.bloom
    const blossomPositions = [
      { x: -18, y: -height * 0.65 },
      { x: -12, y: -height * 0.55 },
      { x: 16, y: -height * 0.75 },
      { x: 10, y: -height * 0.6 },
      { x: -3, y: -height * 0.85 },
      { x: 2, y: -height * 0.7 },
    ]

    for (const pos of blossomPositions) {
      // 5-petal blossom
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2
        ctx.save()
        ctx.translate(pos.x, pos.y)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.ellipse(0, -3, 2, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      // Pink center
      ctx.fillStyle = colors.accent
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = colors.bloom
    }

    // Falling petals
    const petalCount = 4
    for (let i = 0; i < petalCount; i++) {
      const fallPhase = ((time + i * 500) / 2000) % 1
      const px = -15 + i * 10 + Math.sin(time / 300 + i) * 5
      const py = -height * 0.8 + fallPhase * height * 1.2
      const opacity = 1 - fallPhase * 0.5

      ctx.fillStyle = `rgba(255, 183, 197, ${opacity})`
      ctx.beginPath()
      ctx.ellipse(px, py, 2, 1.5, fallPhase * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ===========================================================================
  // BUILDER RENDERING - Gardener
  // ===========================================================================

  renderBuilder = (
    ctx: RenderContext,
    state: BuilderState,
    position: Vec2,
    _animationProgress: number,
    bubble?: { text: string; style: 'working' | 'waiting' | 'done' | 'fading' } | null
  ): void => {
    // Position gardener on the right side
    const x = ctx.width * 0.82
    const y = GROUND_Y * ctx.height

    ctx.ctx.save()
    ctx.ctx.translate(x, y)

    this.drawGardener(ctx.ctx, state, ctx.time, bubble)
    this.drawAmbientEffects(ctx, state)

    ctx.ctx.restore()
  }

  private drawGardener(
    ctx: CanvasRenderingContext2D,
    state: BuilderState,
    time: number,
    bubble?: { text: string; style: 'working' | 'waiting' | 'done' | 'fading' } | null
  ): void {
    // Cycle through gardening actions when working
    if (state === 'working') {
      if (time - this.lastActionChange > this.ACTION_CYCLE_TIME) {
        const actions: Array<'watering' | 'planting' | 'admiring' | 'digging'> = ['watering', 'planting', 'admiring', 'digging']
        const currentIndex = actions.indexOf(this.gardenerAction)
        this.gardenerAction = actions[(currentIndex + 1) % actions.length]
        this.lastActionChange = time
      }
    }

    // Animation parameters
    let bodyBob = 0
    let armAngle = 0
    let headTilt = 0
    let legBend = 0

    switch (state) {
      case 'working':
        switch (this.gardenerAction) {
          case 'watering':
            armAngle = Math.sin(time / 200) * 0.2 + 0.5
            bodyBob = Math.sin(time / 300) * 1
            break
          case 'planting':
            bodyBob = Math.abs(Math.sin(time / 150)) * 3
            armAngle = Math.sin(time / 150) * 0.8
            legBend = Math.abs(Math.sin(time / 150)) * 0.2
            break
          case 'digging':
            armAngle = Math.sin(time / 100) * 1.0
            bodyBob = Math.abs(Math.sin(time / 100)) * 2
            break
          case 'admiring':
            headTilt = Math.sin(time / 500) * 0.15
            armAngle = 0.3
            break
        }
        break
      case 'celebrating':
        bodyBob = Math.abs(Math.sin(time / 100)) * 4
        armAngle = Math.sin(time / 80) * 1.2
        break
      case 'waiting':
        headTilt = Math.sin(time / 800) * 0.1
        break
      case 'idle':
      default:
        bodyBob = Math.sin(time / 1000) * 0.5
        armAngle = Math.sin(time / 1200) * 0.1
        break
    }

    ctx.save()
    ctx.translate(0, bodyBob)

    // Colors
    const skinColor = '#FFDAB9'
    const hatColor = '#8B4513'
    const shirtColor = '#228B22'
    const pantsColor = '#4169E1'
    const bootColor = '#654321'

    // Boots
    ctx.fillStyle = bootColor
    ctx.fillRect(-5, -4, 4, 4)
    ctx.fillRect(1, -4, 4, 4)

    // Legs/pants
    ctx.fillStyle = pantsColor
    ctx.save()
    ctx.rotate(-legBend)
    ctx.fillRect(-4, -12, 3, 8)
    ctx.restore()
    ctx.save()
    ctx.rotate(legBend)
    ctx.fillRect(1, -12, 3, 8)
    ctx.restore()

    // Body/shirt
    ctx.fillStyle = shirtColor
    ctx.fillRect(-5, -22, 10, 10)

    // Arms
    ctx.save()
    ctx.translate(5, -20)
    ctx.rotate(armAngle)
    ctx.fillStyle = shirtColor
    ctx.fillRect(0, 0, 3, 8)
    ctx.fillStyle = skinColor
    ctx.fillRect(0, 8, 3, 3) // Hand

    // Tool in hand when working
    if (state === 'working') {
      this.drawTool(ctx, this.gardenerAction, time)
    }
    ctx.restore()

    // Left arm (static)
    ctx.fillStyle = shirtColor
    ctx.fillRect(-8, -20, 3, 8)
    ctx.fillStyle = skinColor
    ctx.fillRect(-8, -12, 3, 3)

    // Head
    ctx.save()
    ctx.rotate(headTilt)
    ctx.fillStyle = skinColor
    ctx.fillRect(-4, -30, 8, 8)

    // Face
    ctx.fillStyle = '#000'
    ctx.fillRect(-2, -28, 2, 2) // Left eye
    ctx.fillRect(1, -28, 2, 2) // Right eye

    // Smile based on state
    if (state === 'celebrating') {
      ctx.fillRect(-2, -25, 4, 1)
      ctx.fillRect(-3, -26, 1, 1)
      ctx.fillRect(2, -26, 1, 1)
    } else {
      ctx.fillRect(-1, -25, 2, 1)
    }

    // Straw hat
    ctx.fillStyle = hatColor
    ctx.fillRect(-6, -34, 12, 2) // Brim
    ctx.fillStyle = '#DEB887'
    ctx.fillRect(-4, -38, 8, 4) // Crown
    ctx.fillStyle = '#8B0000'
    ctx.fillRect(-4, -35, 8, 1) // Band

    ctx.restore()

    ctx.restore()

    // Speech bubble
    if (bubble) {
      this.drawBubble(ctx, bubble, time)
    }
  }

  private drawTool(ctx: CanvasRenderingContext2D, action: string, time: number): void {
    switch (action) {
      case 'watering':
        // Watering can
        ctx.fillStyle = '#708090'
        ctx.fillRect(2, 8, 8, 6)
        ctx.fillRect(8, 6, 6, 2) // Spout
        // Water drops
        const dropPhase = (time / 150) % 1
        ctx.fillStyle = `rgba(135, 206, 250, ${1 - dropPhase})`
        ctx.beginPath()
        ctx.arc(14, 8 + dropPhase * 10, 2 - dropPhase, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'planting':
        // Seedling/plant
        ctx.fillStyle = '#228B22'
        ctx.fillRect(3, 6, 2, 6)
        ctx.beginPath()
        ctx.ellipse(4, 4, 4, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'digging':
        // Trowel
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(2, 8, 2, 8) // Handle
        ctx.fillStyle = '#C0C0C0'
        ctx.beginPath()
        ctx.moveTo(1, 16)
        ctx.lineTo(5, 16)
        ctx.lineTo(3, 22)
        ctx.closePath()
        ctx.fill()
        break
      case 'admiring':
        // Nothing in hand
        break
    }
  }

  private drawBubble(
    ctx: CanvasRenderingContext2D,
    bubble: { text: string; style: 'working' | 'waiting' | 'done' | 'fading' },
    time: number
  ): void {
    const text = bubble.text
    let opacity = 1
    if (bubble.style === 'fading') {
      opacity = 0.6
    }

    ctx.save()
    ctx.font = 'bold 9px Arial, sans-serif'

    const textWidth = Math.max(ctx.measureText(text).width, 20)
    const bubbleWidth = textWidth + 8
    const bubbleHeight = 14
    const bubbleX = -bubbleWidth - 5
    const bubbleY = -50

    // Bubble background
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * opacity})`
    ctx.beginPath()
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 4)
    ctx.fill()

    // Bubble border
    ctx.strokeStyle = `rgba(34, 139, 34, ${0.8 * opacity})`
    ctx.lineWidth = 1
    ctx.stroke()

    // Tail
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * opacity})`
    ctx.beginPath()
    ctx.moveTo(bubbleX + bubbleWidth - 5, bubbleY + bubbleHeight)
    ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight + 5)
    ctx.lineTo(bubbleX + bubbleWidth - 10, bubbleY + bubbleHeight)
    ctx.fill()

    // Text
    ctx.fillStyle = `rgba(34, 100, 34, ${opacity})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight / 2 + 1)

    ctx.restore()
  }

  private drawAmbientEffects(ctx: RenderContext, state: BuilderState): void {
    // Update and draw butterflies
    for (const butterfly of this.butterflies) {
      butterfly.phase += 0.02
      butterfly.x += Math.sin(butterfly.phase) * 0.002
      butterfly.y += Math.cos(butterfly.phase * 0.7) * 0.001

      // Wrap around
      if (butterfly.x < 0) butterfly.x = 0.9
      if (butterfly.x > 0.9) butterfly.x = 0
      if (butterfly.y < 0.1) butterfly.y = 0.5
      if (butterfly.y > 0.6) butterfly.y = 0.2

      const bx = (butterfly.x - 0.82) * ctx.width
      const by = (butterfly.y - GROUND_Y) * ctx.height

      // Draw butterfly
      ctx.ctx.fillStyle = butterfly.color
      const wingFlap = Math.sin(ctx.time / 50 + butterfly.phase) * 0.5 + 0.5

      ctx.ctx.save()
      ctx.ctx.translate(bx, by)

      // Wings
      ctx.ctx.beginPath()
      ctx.ctx.ellipse(-3, 0, 3 * wingFlap, 4, -0.3, 0, Math.PI * 2)
      ctx.ctx.fill()
      ctx.ctx.beginPath()
      ctx.ctx.ellipse(3, 0, 3 * wingFlap, 4, 0.3, 0, Math.PI * 2)
      ctx.ctx.fill()

      // Body
      ctx.ctx.fillStyle = '#333'
      ctx.ctx.fillRect(-0.5, -3, 1, 6)

      ctx.ctx.restore()
    }

    // Sunlight rays when celebrating
    if (state === 'celebrating') {
      const rayCount = 5
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI - Math.PI / 2
        const rayLength = 30 + Math.sin(ctx.time / 200 + i) * 10
        const opacity = 0.2 + Math.sin(ctx.time / 300 + i * 0.5) * 0.1

        ctx.ctx.strokeStyle = `rgba(255, 255, 0, ${opacity})`
        ctx.ctx.lineWidth = 2
        ctx.ctx.beginPath()
        ctx.ctx.moveTo(-40, -60)
        ctx.ctx.lineTo(-40 + Math.cos(angle) * rayLength, -60 + Math.sin(angle) * rayLength)
        ctx.ctx.stroke()
      }
    }
  }

  // ===========================================================================
  // BACKGROUND RENDERING
  // ===========================================================================

  renderConnections = (ctx: RenderContext, construction: Construction): void => {
    // Draw sky gradient
    const gradient = ctx.ctx.createLinearGradient(0, 0, 0, ctx.height)
    gradient.addColorStop(0, '#87CEEB')
    gradient.addColorStop(0.6, '#B0E0E6')
    gradient.addColorStop(0.8, '#98FB98')
    ctx.ctx.fillStyle = gradient
    ctx.ctx.fillRect(0, 0, ctx.width, ctx.height)

    // Draw sun
    const sunY = 15 + Math.sin(ctx.time / 2000) * 3
    ctx.ctx.fillStyle = '#FFD700'
    ctx.ctx.beginPath()
    ctx.ctx.arc(ctx.width - 25, sunY, 12, 0, Math.PI * 2)
    ctx.ctx.fill()

    // Sun rays
    ctx.ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'
    ctx.ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + ctx.time / 1000
      ctx.ctx.beginPath()
      ctx.ctx.moveTo(ctx.width - 25 + Math.cos(angle) * 14, sunY + Math.sin(angle) * 14)
      ctx.ctx.lineTo(ctx.width - 25 + Math.cos(angle) * 20, sunY + Math.sin(angle) * 20)
      ctx.ctx.stroke()
    }

    // Draw clouds
    this.drawCloud(ctx.ctx, 20, 20, 1)
    this.drawCloud(ctx.ctx, 70, 30, 0.8)
    this.drawCloud(ctx.ctx, 110, 15, 0.6)

    // Draw ground/soil
    ctx.ctx.fillStyle = '#8B4513'
    ctx.ctx.fillRect(0, GROUND_Y * ctx.height, ctx.width, SOIL_HEIGHT * ctx.height)

    // Soil texture
    ctx.ctx.fillStyle = '#6B3E13'
    for (let i = 0; i < 30; i++) {
      const x = (this.hashString(`soil${i}`) % 160)
      const y = GROUND_Y * ctx.height + 2 + (this.hashString(`soily${i}`) % 10)
      ctx.ctx.fillRect(x, y, 3, 2)
    }

    // Grass tufts at soil line
    ctx.ctx.fillStyle = '#228B22'
    for (let i = 0; i < 40; i++) {
      const x = i * 4
      const height = 3 + (this.hashString(`grass${i}`) % 4)
      ctx.ctx.fillRect(x, GROUND_Y * ctx.height - height, 2, height)
    }

    // Draw fence in background
    this.drawFence(ctx.ctx, ctx.width, GROUND_Y * ctx.height)
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.beginPath()
    ctx.arc(x, y, 8 * scale, 0, Math.PI * 2)
    ctx.arc(x + 10 * scale, y - 3 * scale, 10 * scale, 0, Math.PI * 2)
    ctx.arc(x + 22 * scale, y, 8 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawFence(ctx: CanvasRenderingContext2D, width: number, groundY: number): void {
    ctx.fillStyle = '#DEB887'
    const fenceY = groundY - 20

    // Horizontal rails
    ctx.fillRect(0, fenceY + 5, width * 0.75, 2)
    ctx.fillRect(0, fenceY + 12, width * 0.75, 2)

    // Vertical posts
    for (let i = 0; i < 8; i++) {
      const x = i * 14
      ctx.fillRect(x, fenceY, 3, 18)
      // Post top
      ctx.beginPath()
      ctx.moveTo(x, fenceY)
      ctx.lineTo(x + 1.5, fenceY - 4)
      ctx.lineTo(x + 3, fenceY)
      ctx.fill()
    }
  }

  // ===========================================================================
  // ANIMATIONS
  // ===========================================================================

  getPieceAddAnimation(piece: ConstructionPiece): AnimationSequence {
    return {
      id: `grow-${piece.id}`,
      keyframes: [
        { time: 0, scale: 0, opacity: 0 },
        { time: 0.3, scale: 0.3, opacity: 1 },
        { time: 0.7, scale: 1.1, opacity: 1 },
        { time: 1, scale: 1, opacity: 1 },
      ],
      duration: 800,
      easing: 'ease-out',
      loop: false,
    }
  }

  getCompletionAnimation(construction: Construction): AnimationSequence {
    return {
      id: 'garden-complete',
      keyframes: [
        { time: 0, scale: 1 },
        { time: 0.5, scale: 1.05 },
        { time: 1, scale: 1 },
      ],
      duration: 2000,
      easing: 'ease-in-out',
      loop: false,
    }
  }

  // ===========================================================================
  // PLACEMENT
  // ===========================================================================

  generatePiecePosition(category: string, existingPieces: ConstructionPiece[]): Vec2 | undefined {
    // Place plants in a row from left to right
    const x = this.nextPlantX
    this.nextPlantX += 0.08 + Math.random() * 0.04

    // Wrap to new row if needed (though unlikely in typical use)
    if (this.nextPlantX > PLANT_AREA_END) {
      this.nextPlantX = PLANT_AREA_START + Math.random() * 0.05
    }

    return {
      x: x + (Math.random() - 0.5) * 0.02,
      y: GROUND_Y,
    }
  }

  getBuilderWorkPosition(construction: Construction): Vec2 {
    return { x: 0.82, y: GROUND_Y }
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private easeOutBack(t: number): number {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
}

// Register the theme
registerTheme('garden', () => new GardenTheme())
