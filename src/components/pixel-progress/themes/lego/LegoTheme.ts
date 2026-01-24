/**
 * LEGO Theme
 *
 * Building blocks that snap together on a grid.
 * Features a minifig builder character that places bricks.
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
// CONSTANTS
// =============================================================================

// Grid configuration
const GRID_COLS = 12
const INITIAL_GRID_ROWS = 8
const STUD_SIZE = 3
const BRICK_UNIT = 8 // One grid unit in pixels

// Viewport configuration
// Canvas is 100 pixels tall, BRICK_UNIT is 8 pixels, so one row = 8/100 = 0.08 in normalized coords
const GROUND_Y = 0.82 // Ground level (where first row of bricks start, as fraction of canvas height)
const ROW_HEIGHT = 0.08 // Height of each row (matches BRICK_UNIT/canvasHeight = 8/100)
const VISIBLE_ROWS = 10 // Approximately how many rows fit in view (0.82 / 0.08 ≈ 10)
const BUILD_AREA_X = 0.08 // Left edge of build area
const BUILD_AREA_WIDTH = 0.55 // Width of build area (narrower to leave room for builder)

// Brick colors by category
const BRICK_COLORS: Record<string, string> = {
  start: '#4CAF50',    // Green
  create: '#2196F3',   // Blue
  modify: '#FF9800',   // Orange
  execute: '#9C27B0',  // Purple
  search: '#00BCD4',   // Cyan
  analyze: '#3F51B5',  // Indigo
  process: '#607D8B',  // Blue grey
  wait: '#9E9E9E',     // Grey
  input: '#FFEB3B',    // Yellow
  error: '#F44336',    // Red
  success: '#8BC34A',  // Light green
  end: '#E91E63',      // Pink
  default: '#795548',  // Brown
}

// Tool-specific colors (more granular than category)
const TOOL_COLORS: Record<string, string> = {
  // File reading
  Read: '#5C6BC0',     // Indigo
  // File searching
  Glob: '#26A69A',     // Teal
  Grep: '#00ACC1',     // Cyan
  // File writing
  Write: '#42A5F5',    // Blue
  Edit: '#FFA726',     // Orange
  NotebookEdit: '#FF7043', // Deep Orange
  // Execution
  Bash: '#AB47BC',     // Purple
  // Planning
  Task: '#7E57C2',     // Deep Purple
  TodoWrite: '#5E35B1', // Deeper Purple
  // Communication
  AskUserQuestion: '#FFEE58', // Yellow
  // Web
  WebFetch: '#29B6F6',  // Light Blue
  WebSearch: '#26C6DA', // Cyan
}

// Tool-specific sizes
const TOOL_SIZES: Record<string, number> = {
  Read: 2,
  Glob: 2,
  Grep: 2,
  Write: 3,
  Edit: 2,
  NotebookEdit: 3,
  Bash: 3,
  Task: 4,
  TodoWrite: 2,
  AskUserQuestion: 2,
  WebFetch: 2,
  WebSearch: 2,
}

// Brick sizes (width in units) by category
const BRICK_SIZES: Record<string, number> = {
  start: 4,
  create: 3,
  modify: 2,
  execute: 3,
  search: 2,
  analyze: 2,
  process: 2,
  wait: 1,
  input: 2,
  error: 2,
  success: 3,
  end: 4,
  default: 2,
}

// =============================================================================
// LEGO THEME
// =============================================================================

export class LegoTheme extends BaseTheme {
  readonly manifest: ThemeManifest = {
    id: 'lego',
    name: 'LEGO Builder',
    description: 'Build with colorful bricks that snap together',
    author: 'Pixel Progress',
    version: '1.0.0',
    dimensions: { width: 160, height: 100 },
    backgroundColor: '#1a1a2e',
    pixelScale: 4,
    palette: Object.values(BRICK_COLORS),
    categories: [
      { id: 'start', name: 'Foundation', description: 'Starting brick', behavior: 'piece', pieceVariants: 1 },
      { id: 'create', name: 'Build', description: 'New brick', behavior: 'piece', pieceVariants: 3 },
      { id: 'modify', name: 'Adjust', description: 'Modify brick', behavior: 'modifier', pieceVariants: 2 },
      { id: 'execute', name: 'Action', description: 'Action brick', behavior: 'piece', pieceVariants: 2 },
      { id: 'search', name: 'Search', description: 'Search brick', behavior: 'piece', pieceVariants: 2 },
      { id: 'analyze', name: 'Analyze', description: 'Analysis brick', behavior: 'piece', pieceVariants: 2 },
      { id: 'wait', name: 'Wait', description: 'Waiting...', behavior: 'animation' },
      { id: 'input', name: 'Input', description: 'User input', behavior: 'piece', pieceVariants: 1 },
      { id: 'error', name: 'Error', description: 'Oops!', behavior: 'piece', pieceVariants: 1 },
      { id: 'success', name: 'Success', description: 'Success!', behavior: 'piece', pieceVariants: 1 },
      { id: 'end', name: 'Complete', description: 'Capstone', behavior: 'animation' },
    ],
    builderType: 'character',
    placementStrategy: 'grid',
  }

  // Track grid occupancy for stacking
  // Grid uses "rows from ground" indexing: row 0 = ground, row 1 = first level up, etc.
  private grid: Map<string, boolean> = new Map() // key: "x,y"
  private maxHeight: number = 0 // Tracks tallest stack
  private placedBricks: Array<{ x: number; y: number; width: number; pieceId: string }> = []
  private pieceCounter: number = 0 // For deterministic seeding

  // Viewport offset - shifts view up as build grows taller
  private viewportOffset: number = 0 // In normalized coordinates (positive = view shifted up)
  private manualScrollOffset: number = 0 // User's manual scroll adjustment
  private isManualScrolling: boolean = false // Whether user has manually scrolled

  // Compaction damage tracking
  private pieceDamageLevel: Map<string, number> = new Map() // pieceId -> damage level (0-3)
  private isCompacting: boolean = false // True while compaction is ongoing (shake persists)
  private compactionStartTime: number = 0 // When compaction started (for shake animation phase)
  private seenPieceIds: Set<string> = new Set() // Track real piece IDs for damage application
  private initializedPieces: Set<string> = new Set() // Track pieces that have had their first-render logic run

  // Working animation variants - cycles through different animations
  private workingAnimationVariant: 'hammering' | 'creating' | 'typing' | 'lifting' = 'hammering'
  private lastVariantChangeTime: number = 0
  private readonly VARIANT_CYCLE_TIME = 4000 // Change animation every 4 seconds

  constructor() {
    super()
    this.resetGrid()
  }

  private resetGrid(): void {
    this.grid = new Map()
    this.maxHeight = 0
    this.placedBricks = []
    this.pieceCounter = 0
    this.viewportOffset = 0
    this.manualScrollOffset = 0
    this.isManualScrolling = false
    this.pieceDamageLevel = new Map()
    this.isCompacting = false
    this.compactionStartTime = 0
    this.seenPieceIds = new Set()
    this.initializedPieces = new Set()
  }

  /**
   * Check if a grid cell is occupied
   */
  private isOccupied(x: number, y: number): boolean {
    return this.grid.has(`${x},${y}`)
  }

  /**
   * Mark grid cells as occupied
   */
  private setOccupied(x: number, y: number, width: number): void {
    for (let dx = 0; dx < width; dx++) {
      this.grid.set(`${x + dx},${y}`, true)
    }
    this.maxHeight = Math.max(this.maxHeight, y + 1)

    // Scroll view to keep newest bricks visible at the top
    // When build exceeds visible rows, shift everything DOWN so top of build stays in view
    // Only auto-scroll if user hasn't manually scrolled
    if (this.maxHeight > VISIBLE_ROWS && !this.isManualScrolling) {
      this.viewportOffset = (this.maxHeight - VISIBLE_ROWS) * ROW_HEIGHT
    }
  }

  /**
   * Seeded random number generator (deterministic)
   */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 9999) * 10000
    return x - Math.floor(x)
  }

  /**
   * Create a deterministic seed from string
   */
  private createSeed(str: string): number {
    return this.hashString(str) // Uses parent's hashString
  }

  async load(): Promise<void> {
    this.resetGrid()
  }

  dispose(): void {
    this.resetGrid()
  }

  /**
   * Reset when construction is reset
   */
  override onReset(): void {
    this.resetGrid()
  }

  getPlacementStrategy(): PlacementStrategy {
    return 'grid'
  }

  getDefaultMergeStyle(): MergeStyle {
    return 'snap'
  }

  // ===========================================================================
  // GRID MANAGEMENT
  // ===========================================================================

  /**
   * Find the next valid position for a brick of given width.
   * Bricks must either be on the ground (y=0) or have support from below.
   * No overlapping allowed. Uses deterministic positioning.
   *
   * Grid uses "rows from ground" indexing: y=0 is ground level, y=1 is first level up, etc.
   */
  findNextBrickPosition(width: number, seed: number): { gridX: number; gridY: number } {
    // Collect all valid positions with their "score"
    const validPositions: Array<{ x: number; y: number; score: number }> = []

    // Check from ground up to current max height + 1
    const maxY = this.maxHeight + 1

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= GRID_COLS - width; x++) {
        // Check if ALL cells for this brick are clear
        let canPlace = true
        for (let dx = 0; dx < width; dx++) {
          if (this.isOccupied(x + dx, y)) {
            canPlace = false
            break
          }
        }

        if (!canPlace) continue

        // Check for clear vertical drop path from above
        // A brick can only be placed if no bricks above would block it from dropping in
        let hasDropPath = true
        for (let aboveY = y + 1; aboveY <= this.maxHeight && hasDropPath; aboveY++) {
          for (let dx = 0; dx < width; dx++) {
            if (this.isOccupied(x + dx, aboveY)) {
              hasDropPath = false
              break
            }
          }
        }

        if (!hasDropPath) continue

        // Check for support (ground or bricks below)
        const isOnGround = y === 0
        let hasSupport = isOnGround
        let supportCount = isOnGround ? width : 0 // Ground provides full support

        if (!isOnGround) {
          // Need at least one cell below to be occupied
          for (let dx = 0; dx < width; dx++) {
            if (this.isOccupied(x + dx, y - 1)) {
              hasSupport = true
              supportCount++
            }
          }
        }

        if (hasSupport) {
          // Score: balance between building up and spreading horizontally
          // Lower score = better position

          // STRONGLY prefer lower heights - fill rows before going up
          // Penalize each level up heavily
          const heightPenalty = y * 100

          // Prefer positions near existing bricks (spreading out)
          // Count adjacent occupied cells
          let adjacentCount = 0
          // Check left neighbor
          if (x > 0 && this.isOccupied(x - 1, y)) adjacentCount++
          // Check right neighbor
          if (x + width < GRID_COLS && this.isOccupied(x + width, y)) adjacentCount++
          const adjacentBonus = -adjacentCount * 50 // Very strong bonus for being next to existing bricks

          // Count how full this row is - prefer rows that are partially filled
          let rowOccupancy = 0
          for (let rx = 0; rx < GRID_COLS; rx++) {
            if (this.isOccupied(rx, y)) rowOccupancy++
          }
          // Bonus for placing in a row that's partially filled (1-80% full)
          const rowFillRatio = rowOccupancy / GRID_COLS
          const rowFillBonus = (rowFillRatio > 0 && rowFillRatio < 0.8) ? -40 : 0

          // Slight center preference
          const centerPenalty = Math.abs(x + width / 2 - GRID_COLS / 2) * 3

          // Support bonus - prefer better supported positions
          const supportBonus = -supportCount * 15

          const score = heightPenalty + adjacentBonus + rowFillBonus + centerPenalty + supportBonus

          validPositions.push({ x, y, score })
        }
      }
    }

    if (validPositions.length === 0) {
      // Fallback: place on top at center (find highest clear row)
      for (let y = this.maxHeight; y >= 0; y--) {
        const x = Math.floor((GRID_COLS - width) / 2)
        let canPlace = true
        for (let dx = 0; dx < width; dx++) {
          if (this.isOccupied(x + dx, y)) {
            canPlace = false
            break
          }
        }
        if (canPlace) {
          return { gridX: x, gridY: y }
        }
      }
      // Ultimate fallback: next row up
      return { gridX: Math.floor((GRID_COLS - width) / 2), gridY: this.maxHeight }
    }

    // Sort by score (lower is better)
    validPositions.sort((a, b) => a.score - b.score)

    // Deterministically pick from top positions based on seed
    // Group positions by similar scores and pick within the best group
    const bestScore = validPositions[0].score
    const tolerance = 50 // Positions within this score range are considered equivalent
    const topPositions = validPositions.filter(p => p.score <= bestScore + tolerance)

    // Use seeded random to pick deterministically
    const index = Math.floor(this.seededRandom(seed) * topPositions.length)
    const chosen = topPositions[index]

    return { gridX: chosen.x, gridY: chosen.y }
  }

  /**
   * Mark grid cells as occupied and record the brick placement
   */
  placeBrick(gridX: number, gridY: number, width: number, pieceId: string): void {
    this.setOccupied(gridX, gridY, width)
    this.placedBricks.push({ x: gridX, y: gridY, width, pieceId })
  }

  /**
   * Convert grid position to normalized canvas position.
   * Grid y=0 is ground level, positive y goes up.
   * Returns the BASE position WITHOUT viewport offset - viewport is applied at render time.
   */
  gridToCanvas(gridX: number, gridY: number): Vec2 {
    // Base position calculation (without viewport offset)
    // Pieces store this base position, viewport offset is applied during rendering
    const baseY = GROUND_Y - gridY * ROW_HEIGHT

    return {
      x: BUILD_AREA_X + (gridX / GRID_COLS) * BUILD_AREA_WIDTH,
      y: baseY,
    }
  }

  /**
   * Get the current viewport offset (for use by renderer)
   */
  getViewportOffset(): number {
    return this.viewportOffset + this.manualScrollOffset
  }

  /**
   * Apply viewport offset to a Y position for rendering
   */
  applyViewportToY(baseY: number): number {
    return baseY + this.viewportOffset + this.manualScrollOffset
  }

  /**
   * Scroll the viewport by a delta amount (in normalized coordinates)
   * Positive delta = scroll down (see lower parts), negative = scroll up (see higher parts)
   */
  scroll(delta: number): void {
    this.isManualScrolling = true
    this.manualScrollOffset += delta

    // Clamp to valid range
    const minOffset = -this.viewportOffset - 0.1 // Can scroll down a bit past bottom
    const maxOffset = Math.max(0, (this.maxHeight * ROW_HEIGHT) - 0.5) // Can scroll up to see full height
    this.manualScrollOffset = Math.max(minOffset, Math.min(maxOffset, this.manualScrollOffset))
  }

  /**
   * Reset manual scroll to follow auto-scroll again
   */
  resetScroll(): void {
    this.manualScrollOffset = 0
    this.isManualScrolling = false
  }

  /**
   * Get the maximum scrollable height (in rows)
   */
  getMaxHeight(): number {
    return this.maxHeight
  }

  /**
   * Apply compaction damage to all existing pieces and start shaking
   */
  applyCompactionDamage(allPieceIds: string[]): void {
    this.isCompacting = true
    this.compactionStartTime = Date.now()
    console.log('[LegoTheme] applyCompactionDamage called with', allPieceIds.length, 'pieces - shaking until session resumes')
    for (const pieceId of allPieceIds) {
      const currentDamage = this.pieceDamageLevel.get(pieceId) || 0
      // Max damage level is 3
      const newDamage = Math.min(3, currentDamage + 1)
      this.pieceDamageLevel.set(pieceId, newDamage)
    }
  }

  /**
   * Stop compaction shaking (called when session resumes)
   */
  stopCompactionShake(): void {
    if (this.isCompacting) {
      console.log('[LegoTheme] Stopping compaction shake')
      this.isCompacting = false
    }
  }

  /**
   * Get the shake offset if currently shaking from compaction
   * Shake persists throughout entire compaction (until session resumes)
   */
  private getShakeOffset(): { x: number; y: number } {
    if (!this.isCompacting) return { x: 0, y: 0 }

    // Continuous shake while compacting (doesn't decay)
    const elapsed = Date.now() - this.compactionStartTime
    const intensity = 1.5 // Constant intensity
    const freq = 30
    return {
      x: Math.sin(elapsed * freq * 0.01) * intensity,
      y: Math.cos(elapsed * freq * 0.013) * intensity * 0.5,
    }
  }

  // ===========================================================================
  // PIECE RENDERING
  // ===========================================================================

  renderPiece = (
    ctx: RenderContext,
    piece: ConstructionPiece,
    _animationProgress: number
  ): void => {
    // Track this piece ID for damage application
    this.seenPieceIds.add(piece.id)

    // piece.position.y is base position (0 = top, 1 = bottom)
    // viewportOffset pushes things DOWN when positive (scrolling to see top of tall builds)
    const shake = this.getShakeOffset()
    const x = piece.position.x * ctx.width + shake.x
    const totalOffset = this.viewportOffset + this.manualScrollOffset
    const adjustedY = piece.position.y + totalOffset
    const y = adjustedY * ctx.height + shake.y

    // Skip if off-screen
    if (y < -BRICK_UNIT * 4 || y > ctx.height + BRICK_UNIT * 2) return

    // Calculate brick dimensions based on piece.size (which is brick width in units)
    const brickWidth = (piece.size || 2) * BRICK_UNIT
    const brickHeight = BRICK_UNIT

    // Pop-in animation - slide from right (where builder is) with scale
    const age = Date.now() - piece.addedAt
    const animDuration = 300
    const t = Math.min(1, age / animDuration)

    // Get event type for logic below
    const eventType = piece.metadata?.eventType as string | undefined
    const toolName = piece.metadata?.toolName as string | undefined

    // Handle first-render logic for pieces (compaction damage, compaction shake)
    // Use initializedPieces set instead of age check to handle historical events correctly
    const isFirstRender = !this.initializedPieces.has(piece.id)
    if (isFirstRender) {
      this.initializedPieces.add(piece.id)

      // Stop compaction shake when new work starts or session ends
      if (eventType === 'tool_use_start' || eventType === 'user_prompt' ||
          eventType === 'session_end' || eventType === 'agent_stop' || eventType === 'session_paused' || eventType === 'stop') {
        this.stopCompactionShake()
      }

      // Check for compaction event - apply damage to all existing pieces
      // Handle both "compaction" and "context_compaction" event types
      const isCompaction = eventType === 'context_compaction' || eventType === 'compaction' || piece.category === 'optimize'
      if (isCompaction) {
        const allPieceIds = Array.from(this.seenPieceIds).filter(id => id !== piece.id)
        console.log('[LegoTheme] Compaction detected! Applying damage to', allPieceIds.length, 'pieces')
        this.applyCompactionDamage(allPieceIds)
      }
    }

    // For tool_use_start events, don't render a visible brick
    // (the bubble will show via state machine, brick comes when tool_use completes)
    if (eventType === 'tool_use_start') {
      return
    }

    // Drop from above with bounce
    let scale = 1
    let offsetY = 0
    if (t < 1) {
      const dropProgress = this.easeOutBounce(t)
      offsetY = (1 - dropProgress) * -20
      scale = 0.8 + 0.2 * dropProgress
    }

    if (scale <= 0.01) return

    ctx.ctx.save()
    ctx.ctx.translate(x, y + offsetY)
    ctx.ctx.scale(scale, scale)

    // Get brick color - prefer tool-specific color over category color
    const color = piece.color
      ?? (toolName && TOOL_COLORS[toolName])
      ?? BRICK_COLORS[piece.category]
      ?? BRICK_COLORS.default

    // Get damage level for this piece
    const damageLevel = this.pieceDamageLevel.get(piece.id) || 0

    // Draw the brick with damage
    this.drawBrick(ctx.ctx, 0, 0, brickWidth, brickHeight, color, damageLevel)

    ctx.ctx.restore()
  }

  private easeOutBounce(t: number): number {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t
    } else if (t < 2 / 2.75) {
      t -= 1.5 / 2.75
      return 7.5625 * t * t + 0.75
    } else if (t < 2.5 / 2.75) {
      t -= 2.25 / 2.75
      return 7.5625 * t * t + 0.9375
    } else {
      t -= 2.625 / 2.75
      return 7.5625 * t * t + 0.984375
    }
  }

  private drawBrick(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    damageLevel: number = 0
  ): void {
    // Parse color for shading - fade color based on damage
    const fadeFactor = damageLevel * 0.12 // Each damage level fades by 12%
    const baseColor = damageLevel > 0 ? this.fadeColor(color, fadeFactor) : color
    const lightColor = this.lightenColor(baseColor, 30)
    const darkColor = this.darkenColor(baseColor, 30)

    // Main brick body
    ctx.fillStyle = baseColor
    ctx.fillRect(x, y, width, height)

    // Top highlight
    ctx.fillStyle = lightColor
    ctx.fillRect(x, y, width, 1)
    ctx.fillRect(x, y, 1, height)

    // Bottom/right shadow
    ctx.fillStyle = darkColor
    ctx.fillRect(x, y + height - 1, width, 1)
    ctx.fillRect(x + width - 1, y, 1, height)

    // Draw cracks/damage marks based on damage level
    if (damageLevel > 0) {
      ctx.strokeStyle = this.darkenColor(baseColor, 40)
      ctx.lineWidth = 1

      // Crack patterns based on damage level
      if (damageLevel >= 1) {
        // Small diagonal crack
        ctx.beginPath()
        ctx.moveTo(x + width * 0.3, y)
        ctx.lineTo(x + width * 0.5, y + height * 0.6)
        ctx.stroke()
      }
      if (damageLevel >= 2) {
        // Another crack from the other side
        ctx.beginPath()
        ctx.moveTo(x + width * 0.7, y + height)
        ctx.lineTo(x + width * 0.5, y + height * 0.3)
        ctx.stroke()
        // Small chip mark
        ctx.fillStyle = darkColor
        ctx.fillRect(x + width - 2, y + 1, 1, 2)
      }
      if (damageLevel >= 3) {
        // More severe cracking
        ctx.beginPath()
        ctx.moveTo(x + 1, y + height * 0.5)
        ctx.lineTo(x + width * 0.4, y + height * 0.7)
        ctx.stroke()
        // Chip on corner
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillRect(x, y, 2, 2)
      }
    }

    // Draw studs on top
    const numStuds = Math.floor(width / BRICK_UNIT)
    const studSpacing = width / numStuds

    for (let i = 0; i < numStuds; i++) {
      const studX = x + studSpacing * i + studSpacing / 2
      const studY = y - STUD_SIZE + 1

      // Stud base
      ctx.fillStyle = baseColor
      ctx.beginPath()
      ctx.arc(studX, studY + STUD_SIZE / 2, STUD_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()

      // Stud highlight
      ctx.fillStyle = lightColor
      ctx.beginPath()
      ctx.arc(studX - 0.5, studY + STUD_SIZE / 2 - 0.5, STUD_SIZE / 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /**
   * Fade a color towards gray
   */
  private fadeColor(color: string, amount: number): string {
    // Parse hex color
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    // Mix towards gray (128)
    const gray = 128
    const newR = Math.round(r + (gray - r) * amount)
    const newG = Math.round(g + (gray - g) * amount)
    const newB = Math.round(b + (gray - b) * amount)

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
  }

  // ===========================================================================
  // BUILDER RENDERING - LEGO Minifig
  // ===========================================================================

  renderBuilder = (
    ctx: RenderContext,
    state: BuilderState,
    position: Vec2,
    _animationProgress: number,
    bubble?: { text: string; style: 'working' | 'waiting' | 'done' | 'fading' } | null
  ): void => {
    // Position builder on the right side at a FIXED screen position
    // The minifig doesn't scroll with the bricks - it stays visible on screen
    const x = ctx.width * 0.72 + 10  // Moved 10px to the right
    const y = ctx.height * 0.65 + 6 // Fixed position near bottom-right of canvas, moved 6px down

    ctx.ctx.save()
    ctx.ctx.translate(x, y)

    this.drawMinifig(ctx.ctx, state, ctx.time, bubble)

    ctx.ctx.restore()
  }

  // Track last logged state to avoid spam
  private lastLoggedMinifigState: BuilderState = 'idle'

  private drawMinifig(
    ctx: CanvasRenderingContext2D,
    state: BuilderState,
    time: number,
    bubble?: { text: string; style: 'working' | 'waiting' | 'done' | 'fading' } | null
  ): void {
    // Log state changes
    if (state !== this.lastLoggedMinifigState) {
      console.log('[LegoTheme.drawMinifig] State changed to:', state)
      this.lastLoggedMinifigState = state
    }

    // Animation parameters - always have some movement to show he's alive
    // Base subtle animation that's always present
    const baseHeadBob = Math.sin(time / 800) * 0.3
    const baseArmAngle = Math.sin(time / 1000) * 0.08

    let headBob = baseHeadBob
    let armAngle = baseArmAngle
    let legAngle = 0
    let bodyTilt = 0

    switch (state) {
      case 'working':
        // Cycle through animation variants every VARIANT_CYCLE_TIME ms
        if (time - this.lastVariantChangeTime > this.VARIANT_CYCLE_TIME) {
          const variants: Array<'hammering' | 'creating' | 'typing' | 'lifting'> = ['hammering', 'creating', 'typing', 'lifting']
          const currentIndex = variants.indexOf(this.workingAnimationVariant)
          this.workingAnimationVariant = variants[(currentIndex + 1) % variants.length]
          this.lastVariantChangeTime = time
        }

        switch (this.workingAnimationVariant) {
          case 'hammering':
            // Energetic hammering/building motion
            armAngle = Math.sin(time / 60) * 1.2
            headBob = Math.sin(time / 80) * 2
            legAngle = 0
            bodyTilt = Math.sin(time / 60) * 0.08
            break
          case 'creating':
            // Magical creation gesture - arms raised, looking up
            armAngle = Math.sin(time / 150) * 0.4 + 0.8  // Arms raised with gentle wave
            headBob = Math.sin(time / 200) * 1 - 2  // Looking slightly up
            legAngle = Math.sin(time / 300) * 0.1
            bodyTilt = Math.sin(time / 250) * 0.03
            break
          case 'typing':
            // Fast typing motion - small rapid movements
            armAngle = Math.sin(time / 30) * 0.3  // Very fast, small movements
            headBob = Math.sin(time / 150) * 0.8  // Slight focused head movement
            legAngle = 0
            bodyTilt = Math.sin(time / 200) * 0.02  // Minimal body movement
            break
          case 'lifting':
            // Heavy lifting motion - slower, more dramatic
            armAngle = Math.sin(time / 200) * 0.6 + 0.4  // Slower arm movement, slightly raised
            headBob = Math.abs(Math.sin(time / 150)) * 1.5  // Straining head bob
            legAngle = Math.sin(time / 250) * 0.15  // Slight stance adjustment
            bodyTilt = Math.sin(time / 200) * 0.06 + 0.02  // Leaning into the lift
            break
        }
        break
      case 'walking':
        legAngle = Math.sin(time / 100) * 0.4
        armAngle = -Math.sin(time / 100) * 0.3
        headBob = Math.abs(Math.sin(time / 100)) * 0.5
        break
      case 'waiting':
        // Standing still, just waiting patiently for user input
        // No animation - he's attentive and ready
        headBob = 0
        armAngle = 0
        legAngle = 0
        bodyTilt = 0
        break
      case 'thinking':
        // Active thinking - looking around, hand to chin type motion
        headBob = Math.sin(time / 200) * 2  // Head moves more
        armAngle = Math.sin(time / 300) * 0.5  // Arm gestures
        legAngle = Math.sin(time / 400) * 0.1  // Slight weight shift
        bodyTilt = Math.sin(time / 350) * 0.04
        break
      case 'celebrating':
        headBob = Math.abs(Math.sin(time / 100)) * 3
        armAngle = Math.sin(time / 80) * 0.8
        legAngle = Math.sin(time / 120) * 0.2
        break
      case 'frustrated':
        headBob = Math.sin(time / 50) * 2
        armAngle = Math.sin(time / 80) * 0.3
        break
      case 'searching':
        // Active searching - looking around, pointing, scanning
        headBob = Math.sin(time / 150) * 2.5  // Looking up and down actively
        armAngle = Math.sin(time / 120) * 0.7 + Math.sin(time / 200) * 0.3  // Pointing around
        legAngle = Math.sin(time / 300) * 0.15  // Shifting stance
        bodyTilt = Math.sin(time / 180) * 0.06  // Leaning to look
        break
      case 'receiving':
        // Actively receiving/processing - nodding, gesturing understanding
        headBob = Math.abs(Math.sin(time / 100)) * 2.5  // Active nodding
        armAngle = Math.sin(time / 150) * 0.5  // Hand gestures
        legAngle = Math.sin(time / 250) * 0.12
        bodyTilt = Math.sin(time / 200) * 0.04
        break
      case 'idle':
      default:
        // Idle uses base animation (already set above)
        // Add slight extra movement
        headBob = baseHeadBob + Math.sin(time / 600) * 0.3
        armAngle = baseArmAngle + Math.sin(time / 700) * 0.1
        break
    }

    // Colors
    const skinColor = '#FFCC80'
    const hairColor = '#5D4037'
    const shirtColor = '#1976D2'
    const pantsColor = '#D32F2F'
    const handColor = skinColor

    ctx.save()

    // Scale minifig and apply body tilt for working animation
    ctx.scale(1.2, 1.2)
    if (bodyTilt !== 0) {
      ctx.rotate(bodyTilt)
    }

    // Legs
    ctx.save()
    ctx.translate(-3, 8)
    ctx.rotate(legAngle)
    ctx.fillStyle = pantsColor
    ctx.fillRect(0, 0, 3, 8)
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 6, 3, 2) // Shoe
    ctx.restore()

    ctx.save()
    ctx.translate(0, 8)
    ctx.rotate(-legAngle)
    ctx.fillStyle = pantsColor
    ctx.fillRect(0, 0, 3, 8)
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 6, 3, 2) // Shoe
    ctx.restore()

    // Torso
    ctx.fillStyle = shirtColor
    ctx.fillRect(-4, 0, 8, 8)

    // Arms
    ctx.save()
    ctx.translate(-5, 1)
    ctx.rotate(-0.3 + armAngle)
    ctx.fillStyle = shirtColor
    ctx.fillRect(-1, 0, 3, 6)
    ctx.fillStyle = handColor
    ctx.fillRect(-1, 5, 3, 2) // Hand
    ctx.restore()

    ctx.save()
    ctx.translate(4, 1)
    ctx.rotate(0.3 - armAngle)
    ctx.fillStyle = shirtColor
    ctx.fillRect(-1, 0, 3, 6)
    ctx.fillStyle = handColor
    ctx.fillRect(-1, 5, 3, 2) // Hand

    // Holding a brick when working
    if (state === 'working' || state === 'walking') {
      ctx.fillStyle = '#4CAF50'
      ctx.fillRect(-2, 6, 6, 4)
      // Studs
      ctx.fillStyle = this.lightenColor('#4CAF50', 20)
      ctx.beginPath()
      ctx.arc(0, 5, 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(3, 5, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Head
    ctx.fillStyle = skinColor
    ctx.fillRect(-4, -12 + headBob, 8, 8)

    // Face
    ctx.fillStyle = '#333'
    // Eyes
    if (state === 'celebrating') {
      // Happy closed eyes
      ctx.fillRect(-3, -9 + headBob, 2, 1)
      ctx.fillRect(1, -9 + headBob, 2, 1)
      // Smile
      ctx.fillRect(-2, -6 + headBob, 4, 1)
    } else if (state === 'frustrated') {
      // Angry eyes
      ctx.fillRect(-3, -9 + headBob, 2, 2)
      ctx.fillRect(1, -9 + headBob, 2, 2)
      // Frown
      ctx.fillRect(-2, -5 + headBob, 4, 1)
    } else {
      // Normal eyes
      ctx.fillRect(-3, -9 + headBob, 2, 2)
      ctx.fillRect(1, -9 + headBob, 2, 2)
      // Neutral mouth
      ctx.fillRect(-1, -6 + headBob, 2, 1)
    }

    // Hair/hat
    ctx.fillStyle = hairColor
    ctx.fillRect(-4, -14 + headBob, 8, 3)
    ctx.fillRect(-5, -12 + headBob, 10, 1)

    // Hard hat for builder
    ctx.fillStyle = '#FFC107'
    ctx.fillRect(-5, -15 + headBob, 10, 2)
    ctx.fillRect(-4, -17 + headBob, 8, 2)

    // Visual effects based on state and animation variant
    const isActiveState = state === 'working' || state === 'searching' || state === 'thinking' || state === 'receiving'
    if (isActiveState) {
      if (state === 'working') {
        // Different effects for each working animation variant
        switch (this.workingAnimationVariant) {
          case 'hammering':
            // Motion lines on the working side (right arm)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
            ctx.lineWidth = 1
            const motionPhase = (time / 60) % (Math.PI * 2)
            const lineOpacity = Math.abs(Math.sin(motionPhase))
            ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity * 0.7})`
            for (let i = 0; i < 3; i++) {
              const lineY = -2 + i * 3
              const lineX = 12 + Math.sin(time / 40 + i) * 2
              ctx.beginPath()
              ctx.moveTo(lineX, lineY)
              ctx.lineTo(lineX + 4, lineY - 1)
              ctx.stroke()
            }
            // Sweat drops
            const sweatPhase = (time / 200) % 1
            ctx.fillStyle = `rgba(150, 200, 255, ${0.7 - sweatPhase * 0.7})`
            const sweat1X = -6 + sweatPhase * 6
            const sweat1Y = -18 + headBob - sweatPhase * 8
            ctx.beginPath()
            ctx.arc(sweat1X, sweat1Y, 1.5 - sweatPhase * 0.5, 0, Math.PI * 2)
            ctx.fill()
            break

          case 'creating':
            // Sparkle/magic effects floating upward
            const sparkleColors = ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FF6347']
            for (let i = 0; i < 6; i++) {
              const sparklePhase = ((time + i * 150) / 400) % 1
              const sparkleX = 8 + Math.sin(time / 100 + i * 1.2) * 8
              const sparkleY = -5 - sparklePhase * 25 + Math.sin(time / 80 + i) * 3
              const sparkleSize = (1 - sparklePhase) * 2.5
              const sparkleOpacity = (1 - sparklePhase) * 0.9

              ctx.fillStyle = sparkleColors[i % sparkleColors.length].replace(')', `, ${sparkleOpacity})`).replace('rgb', 'rgba').replace('#', '')
              // Convert hex to rgba
              const hex = sparkleColors[i % sparkleColors.length]
              const r = parseInt(hex.slice(1, 3), 16)
              const g = parseInt(hex.slice(3, 5), 16)
              const b = parseInt(hex.slice(5, 7), 16)
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${sparkleOpacity})`

              // Draw star shape
              ctx.beginPath()
              for (let j = 0; j < 4; j++) {
                const angle = (j / 4) * Math.PI * 2 + time / 200
                const px = sparkleX + Math.cos(angle) * sparkleSize
                const py = sparkleY + Math.sin(angle) * sparkleSize
                if (j === 0) ctx.moveTo(px, py)
                else ctx.lineTo(px, py)
              }
              ctx.closePath()
              ctx.fill()

              // Add center glow
              ctx.beginPath()
              ctx.arc(sparkleX, sparkleY, sparkleSize * 0.5, 0, Math.PI * 2)
              ctx.fill()
            }
            // Magic circle effect at hands
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(time / 100) * 0.2})`
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(10, -8, 6 + Math.sin(time / 80) * 2, 0, Math.PI * 2)
            ctx.stroke()
            break

          case 'typing':
            // Small rapid dots/clicks near hands
            for (let i = 0; i < 4; i++) {
              const clickPhase = ((time + i * 80) / 150) % 1
              const clickX = 6 + (i % 2) * 4 + Math.sin(time / 20 + i) * 1
              const clickY = 2 + Math.floor(i / 2) * 2
              const clickOpacity = clickPhase < 0.3 ? 1 : (1 - clickPhase) * 0.8
              ctx.fillStyle = `rgba(100, 200, 255, ${clickOpacity})`
              ctx.fillRect(clickX, clickY, 2, 1)
            }
            // Keyboard glow
            ctx.fillStyle = `rgba(50, 150, 255, ${0.2 + Math.sin(time / 50) * 0.1})`
            ctx.fillRect(4, 3, 10, 4)
            break

          case 'lifting':
            // Strain lines and effort marks
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)'
            ctx.lineWidth = 1
            // Effort lines near head
            for (let i = 0; i < 2; i++) {
              const strainX = -8 - i * 3
              const strainY = -12 + headBob + Math.sin(time / 100 + i) * 2
              ctx.beginPath()
              ctx.moveTo(strainX, strainY)
              ctx.lineTo(strainX - 3, strainY - 2)
              ctx.stroke()
            }
            // Heavy object indicator (box being lifted)
            const liftY = -4 + Math.sin(time / 200) * 2
            ctx.fillStyle = `rgba(139, 90, 43, ${0.8})`
            ctx.fillRect(8, liftY, 8, 6)
            ctx.strokeStyle = 'rgba(101, 67, 33, 1)'
            ctx.lineWidth = 1
            ctx.strokeRect(8, liftY, 8, 6)
            // Weight lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
            for (let i = 0; i < 2; i++) {
              ctx.beginPath()
              ctx.moveTo(10 + i * 3, liftY + 7)
              ctx.lineTo(10 + i * 3, liftY + 10)
              ctx.stroke()
            }
            break
        }
      } else {
        // Default effects for other active states (searching, thinking, receiving)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.lineWidth = 1
        const motionPhase = (time / 60) % (Math.PI * 2)
        const lineOpacity = Math.abs(Math.sin(motionPhase))
        ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity * 0.7})`
        for (let i = 0; i < 3; i++) {
          const lineY = -2 + i * 3
          const lineX = 12 + Math.sin(time / 40 + i) * 2
          ctx.beginPath()
          ctx.moveTo(lineX, lineY)
          ctx.lineTo(lineX + 4, lineY - 1)
          ctx.stroke()
        }
      }
    }

    ctx.restore()

    // Render bubble from state machine (single source of truth)
    if (bubble) {
      const text = bubble.text
      const isWorking = bubble.style === 'working'
      const isWaiting = bubble.style === 'waiting'
      const isDone = bubble.style === 'done'
      const isFading = bubble.style === 'fading'

      // Calculate opacity based on style
      let opacity = 1
      if (isFading) {
        // For fading bubbles, calculate opacity based on time
        // This is a simplification - ideally we'd track the start time
        opacity = 0.7
      }

      // Calculate where blocks end relative to minifig position
      const blocksEndX = -22

      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.font = 'bold 10px Arial, sans-serif'

      const textWidth = Math.max(ctx.measureText(text).width, 24)
      const bubbleWidth = textWidth + 10
      const bubbleHeight = 14
      const bubbleX = blocksEndX
      const bubbleY = -40 + headBob

      // Small connecting bubbles
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * opacity})`
      ctx.beginPath()
      ctx.arc(10, -12 + headBob, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(10, -22 + headBob, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(8, -32 + headBob, 3, 0, Math.PI * 2)
      ctx.fill()

      // Bubble animation based on style
      const bubbleBounce = (isWaiting || isDone) ? Math.sin(time / 300) * 2 : 0
      const workingPulse = isWorking ? Math.sin(time / 200) * 1.5 : 0
      const adjustedBubbleY = bubbleY - 12 + bubbleBounce + workingPulse

      // Pulsing opacity when working
      const pulseOpacity = isWorking ? 0.85 + Math.sin(time / 150) * 0.1 : 0.95
      ctx.fillStyle = `rgba(255, 255, 255, ${pulseOpacity * opacity})`
      ctx.beginPath()
      ctx.roundRect(bubbleX, adjustedBubbleY, bubbleWidth, bubbleHeight, 4)
      ctx.fill()

      // Bubble border
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 * opacity})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Text
      ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, bubbleX + bubbleWidth / 2, adjustedBubbleY + bubbleHeight / 2 + 1)
      ctx.restore()
    }
  }

  // ===========================================================================
  // CONNECTIONS - Show brick interlocking
  // ===========================================================================

  renderConnections(ctx: RenderContext, construction: Construction): void {
    // Draw the baseplate (ground) for LEGO bricks to sit on
    this.drawBaseplate(ctx)
  }

  private drawBaseplate(ctx: RenderContext): void {
    const buildAreaX = ctx.width * BUILD_AREA_X
    const buildAreaWidth = ctx.width * BUILD_AREA_WIDTH

    // Ground position WITH viewport offset (same as pieces)
    const totalOffset = this.viewportOffset + this.manualScrollOffset
    const groundY = (GROUND_Y + totalOffset) * ctx.height

    // Baseplate is green like classic LEGO baseplates
    const baseplateColor = '#2E7D32'
    const baseplateLight = '#43A047'
    const baseplateDark = '#1B5E20'

    // Baseplate sits below where bricks go (brick bottom = groundY + BRICK_UNIT)
    const baseplateHeight = 6
    const baseplateY = groundY + BRICK_UNIT + 1  // Just below first row of bricks

    // Only draw if baseplate is on screen (not scrolled off bottom)
    if (baseplateY < ctx.height) {
      ctx.ctx.fillStyle = baseplateColor
      ctx.ctx.fillRect(buildAreaX, baseplateY, buildAreaWidth, baseplateHeight)

      // Top highlight
      ctx.ctx.fillStyle = baseplateLight
      ctx.ctx.fillRect(buildAreaX, baseplateY, buildAreaWidth, 1)

      // Bottom shadow
      ctx.ctx.fillStyle = baseplateDark
      ctx.ctx.fillRect(buildAreaX, baseplateY + baseplateHeight - 1, buildAreaWidth, 1)

      // Draw studs on baseplate
      ctx.ctx.fillStyle = baseplateLight
      const studSpacing = BRICK_UNIT
      for (let x = buildAreaX + studSpacing / 2; x < buildAreaX + buildAreaWidth; x += studSpacing) {
        ctx.ctx.beginPath()
        ctx.ctx.arc(x, baseplateY + 2, 2, 0, Math.PI * 2)
        ctx.ctx.fill()
      }

      // Draw ground/table surface below baseplate to edge of canvas
      const surfaceTop = baseplateY + baseplateHeight
      if (surfaceTop < ctx.height) {
        ctx.ctx.fillStyle = '#3d3d5c'
        ctx.ctx.fillRect(0, surfaceTop, ctx.width, ctx.height - surfaceTop)
      }
    }
  }

  // ===========================================================================
  // ANIMATIONS
  // ===========================================================================

  getPieceAddAnimation(piece: ConstructionPiece): AnimationSequence {
    return {
      id: `add-${piece.id}`,
      keyframes: [
        { time: 0, scale: 0, opacity: 0, offset: { x: 0, y: -20 } },
        { time: 0.6, scale: 1.1, opacity: 1, offset: { x: 0, y: 2 } },
        { time: 0.8, scale: 0.95, opacity: 1, offset: { x: 0, y: -1 } },
        { time: 1, scale: 1, opacity: 1, offset: { x: 0, y: 0 } },
      ],
      duration: 300,
      easing: 'ease-out',
      loop: false,
    }
  }

  getCompletionAnimation(construction: Construction): AnimationSequence {
    return {
      id: 'completion',
      keyframes: [
        { time: 0, effects: [{ type: 'flash', intensity: 0.5, color: '#FFD700' }] },
        { time: 0.3, effects: [{ type: 'particles', intensity: 1 }] },
        { time: 1 },
      ],
      duration: 2000,
      easing: 'ease-out',
      loop: false,
    }
  }

  getBuilderWorkPosition(construction: Construction): Vec2 {
    // Builder position (base position, viewport applied at render time)
    return { x: 0.75, y: GROUND_Y - 0.08 }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private easeOutBack(t: number): number {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.min(255, (num >> 16) + amt)
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt)
    const B = Math.min(255, (num & 0x0000ff) + amt)
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.max(0, (num >> 16) - amt)
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt)
    const B = Math.max(0, (num & 0x0000ff) - amt)
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`
  }

  /**
   * Override piece creation to handle grid placement.
   * Uses deterministic positioning based on piece count.
   */
  override generatePiecePosition(category: string, existingPieces: ConstructionPiece[]): Vec2 {
    const brickWidth = BRICK_SIZES[category] ?? BRICK_SIZES.default

    // Create a deterministic seed from piece counter and category
    const seed = this.createSeed(`${this.pieceCounter}-${category}`)
    this.pieceCounter++

    const { gridX, gridY } = this.findNextBrickPosition(brickWidth, seed)

    // Mark as placed
    this.placeBrick(gridX, gridY, brickWidth, `piece-${this.pieceCounter}`)

    return this.gridToCanvas(gridX, gridY)
  }

  /**
   * Override piece size for brick dimensions
   */
  override getPieceSize(category: string): number {
    return BRICK_SIZES[category] ?? BRICK_SIZES.default
  }
}

// =============================================================================
// REGISTER
// =============================================================================

registerTheme('lego', () => new LegoTheme())

export default LegoTheme
