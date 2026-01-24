/**
 * Placement Engine
 *
 * Determines where new pieces should be placed in the construction.
 * Supports multiple placement strategies.
 */

import type {
  Construction,
  ConstructionPiece,
  PlacementStrategy,
  PlacementResult,
  AttachmentPoint,
  Vec2,
  MergeStyle,
} from '../types'

// =============================================================================
// PLACEMENT ENGINE
// =============================================================================

export interface PlacementEngineConfig {
  strategy: PlacementStrategy
  mergeStyle: MergeStyle

  // Organic strategy params
  growthBias?: Vec2 // Preferred growth direction
  connectionAffinity?: number // 0-1, how much pieces want to connect

  // Grid strategy params
  gridSize?: number
  fillPattern?: 'row-by-row' | 'spiral' | 'random-fill'

  // Layered strategy params
  layerHeight?: number
  layerMapping?: Record<string, number> // category → layer

  // Radial strategy params
  spiralTightness?: number

  // General
  padding?: number // Min distance from edges
  minPieceDistance?: number // Min distance between pieces
}

const DEFAULT_CONFIG: PlacementEngineConfig = {
  strategy: 'organic',
  mergeStyle: 'blend',
  connectionAffinity: 0.7,
  padding: 0.08,
  minPieceDistance: 0.03,
  gridSize: 0.1,
  layerHeight: 0.15,
  spiralTightness: 0.05,
}

export class PlacementEngine {
  private config: PlacementEngineConfig

  constructor(config: Partial<PlacementEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Calculate placement for a new piece
   */
  calculatePlacement(
    pieceCategory: string,
    construction: Construction
  ): PlacementResult {
    switch (this.config.strategy) {
      case 'organic':
        return this.organicPlacement(pieceCategory, construction)
      case 'grid':
        return this.gridPlacement(pieceCategory, construction)
      case 'layered':
        return this.layeredPlacement(pieceCategory, construction)
      case 'radial':
        return this.radialPlacement(pieceCategory, construction)
      case 'gravity':
        return this.gravityPlacement(pieceCategory, construction)
      case 'flow':
        return this.flowPlacement(pieceCategory, construction)
      default:
        return this.organicPlacement(pieceCategory, construction)
    }
  }

  /**
   * Find the best attachment point on the construction
   */
  findAttachmentPoint(
    construction: Construction,
    preferredDirection?: Vec2
  ): AttachmentPoint {
    const pieces = construction.pieces

    if (pieces.length === 0) {
      return {
        position: { x: 0.5, y: 0.5 },
        normal: { x: 0, y: -1 },
      }
    }

    // Find pieces on the outer edge
    const outerPieces = this.findOuterPieces(construction)

    // Pick one based on preferred direction or random
    let targetPiece: ConstructionPiece
    if (preferredDirection && outerPieces.length > 0) {
      // Find piece most aligned with preferred direction from center
      targetPiece = outerPieces.reduce((best, piece) => {
        const dirToPiece = this.normalize({
          x: piece.position.x - construction.centerOfMass.x,
          y: piece.position.y - construction.centerOfMass.y,
        })
        const alignment = this.dot(dirToPiece, preferredDirection)

        const bestDir = this.normalize({
          x: best.position.x - construction.centerOfMass.x,
          y: best.position.y - construction.centerOfMass.y,
        })
        const bestAlignment = this.dot(bestDir, preferredDirection)

        return alignment > bestAlignment ? piece : best
      }, outerPieces[0])
    } else {
      targetPiece = outerPieces[Math.floor(Math.random() * outerPieces.length)]
    }

    // Calculate normal (direction away from center)
    const normal = this.normalize({
      x: targetPiece.position.x - construction.centerOfMass.x,
      y: targetPiece.position.y - construction.centerOfMass.y,
    })

    return {
      position: targetPiece.position,
      normal,
      existingPieceId: targetPiece.id,
    }
  }

  // ===========================================================================
  // PLACEMENT STRATEGIES
  // ===========================================================================

  /**
   * Organic: Pieces grow outward from existing pieces
   */
  private organicPlacement(
    _category: string,
    construction: Construction
  ): PlacementResult {
    const pieces = construction.pieces

    if (pieces.length === 0) {
      return this.centerPlacement()
    }

    const affinity = this.config.connectionAffinity ?? 0.7

    // Usually attach to existing piece
    if (Math.random() < affinity) {
      const attachment = this.findAttachmentPoint(
        construction,
        this.config.growthBias
      )

      // Calculate position along normal from attachment
      const distance = 0.04 + Math.random() * 0.06
      const jitter = (Math.random() - 0.5) * 0.03

      const position = this.clampToCanvas({
        x: attachment.position.x + attachment.normal.x * distance + jitter,
        y: attachment.position.y + attachment.normal.y * distance + jitter,
      })

      return {
        position,
        rotation: (Math.random() - 0.5) * 0.3,
        depth: pieces.length,
        attachedTo: attachment.existingPieceId,
        attachmentPoint: attachment.position,
      }
    }

    // Sometimes place in nearby empty space
    return this.findEmptySpace(construction)
  }

  /**
   * Grid: Pieces snap to grid positions
   */
  private gridPlacement(
    _category: string,
    construction: Construction
  ): PlacementResult {
    const gridSize = this.config.gridSize ?? 0.1
    const pieces = construction.pieces

    // Find occupied grid cells
    const occupied = new Set<string>()
    for (const piece of pieces) {
      const cellX = Math.floor(piece.position.x / gridSize)
      const cellY = Math.floor(piece.position.y / gridSize)
      occupied.add(`${cellX},${cellY}`)
    }

    // Find next empty cell based on fill pattern
    let nextCell: { x: number; y: number }

    switch (this.config.fillPattern) {
      case 'spiral':
        nextCell = this.findSpiralCell(occupied, gridSize)
        break
      case 'random-fill':
        nextCell = this.findRandomEmptyCell(occupied, gridSize)
        break
      case 'row-by-row':
      default:
        nextCell = this.findRowByRowCell(occupied, gridSize)
    }

    const position = {
      x: nextCell.x * gridSize + gridSize / 2,
      y: nextCell.y * gridSize + gridSize / 2,
    }

    // Find nearest existing piece for attachment
    const nearest = this.findNearestPiece(position, pieces)

    return {
      position,
      rotation: 0, // Grid pieces don't rotate
      depth: pieces.length,
      attachedTo: nearest?.id,
      attachmentPoint: nearest?.position ?? position,
    }
  }

  /**
   * Layered: Pieces stack in horizontal layers
   */
  private layeredPlacement(
    category: string,
    construction: Construction
  ): PlacementResult {
    const pieces = construction.pieces
    const layerHeight = this.config.layerHeight ?? 0.15
    const layerMapping = this.config.layerMapping ?? {}

    // Determine layer for this category
    const layer = layerMapping[category] ?? Math.floor(pieces.length / 5)

    // Find pieces in this layer
    const piecesInLayer = pieces.filter((p) => {
      const pLayer = layerMapping[p.category] ?? Math.floor(pieces.indexOf(p) / 5)
      return pLayer === layer
    })

    // Position horizontally with some spread
    const xOffset = 0.1 + (piecesInLayer.length * 0.08)
    const position = {
      x: Math.min(0.9, xOffset + (Math.random() - 0.5) * 0.05),
      y: 0.9 - layer * layerHeight + (Math.random() - 0.5) * 0.02,
    }

    // Attach to piece below or beside
    const nearest = this.findNearestPiece(position, pieces)

    return {
      position,
      rotation: (Math.random() - 0.5) * 0.1,
      depth: layer,
      attachedTo: nearest?.id,
      attachmentPoint: nearest?.position ?? position,
    }
  }

  /**
   * Radial: Pieces spiral outward from center
   */
  private radialPlacement(
    _category: string,
    construction: Construction
  ): PlacementResult {
    const pieces = construction.pieces
    const tightness = this.config.spiralTightness ?? 0.05

    // Spiral parameters based on piece count
    const angle = pieces.length * 0.5 // Golden angle approximation
    const radius = Math.sqrt(pieces.length) * tightness

    const position = this.clampToCanvas({
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
    })

    // Attach to previous piece in spiral
    const attachTo = pieces.length > 0 ? pieces[pieces.length - 1] : undefined

    return {
      position,
      rotation: angle,
      depth: pieces.length,
      attachedTo: attachTo?.id,
      attachmentPoint: attachTo?.position ?? { x: 0.5, y: 0.5 },
    }
  }

  /**
   * Gravity: Pieces fall and stack (Tetris-like)
   */
  private gravityPlacement(
    _category: string,
    construction: Construction
  ): PlacementResult {
    const pieces = construction.pieces

    // Random x position
    const x = 0.1 + Math.random() * 0.8

    // Find highest piece at this x (pieces stack from bottom)
    let highestY = 0.9 // Start at bottom
    for (const piece of pieces) {
      if (Math.abs(piece.position.x - x) < 0.08) {
        highestY = Math.min(highestY, piece.position.y - 0.06)
      }
    }

    const position = {
      x,
      y: Math.max(0.1, highestY),
    }

    const attachTo = this.findNearestPiece(position, pieces)

    return {
      position,
      rotation: 0,
      depth: pieces.length,
      attachedTo: attachTo?.id,
      attachmentPoint: attachTo?.position ?? position,
    }
  }

  /**
   * Flow: Pieces follow a curved path
   */
  private flowPlacement(
    _category: string,
    construction: Construction
  ): PlacementResult {
    const pieces = construction.pieces

    // Simple bezier curve across the canvas
    const t = (pieces.length * 0.03) % 1

    // Control points for S-curve
    const p0 = { x: 0.1, y: 0.9 }
    const p1 = { x: 0.3, y: 0.1 }
    const p2 = { x: 0.7, y: 0.9 }
    const p3 = { x: 0.9, y: 0.1 }

    const position = this.evaluateBezier(p0, p1, p2, p3, t)

    // Attach to previous piece
    const attachTo = pieces.length > 0 ? pieces[pieces.length - 1] : undefined

    return {
      position,
      rotation: this.getBezierTangentAngle(p0, p1, p2, p3, t),
      depth: pieces.length,
      attachedTo: attachTo?.id,
      attachmentPoint: attachTo?.position ?? position,
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private centerPlacement(): PlacementResult {
    return {
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      depth: 0,
      attachmentPoint: { x: 0.5, y: 0.5 },
    }
  }

  private findEmptySpace(construction: Construction): PlacementResult {
    const pieces = construction.pieces
    const { centerOfMass } = construction

    // Try random positions near center of mass
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const distance = 0.1 + Math.random() * 0.2
      const candidate = {
        x: centerOfMass.x + Math.cos(angle) * distance,
        y: centerOfMass.y + Math.sin(angle) * distance,
      }

      if (this.isPositionClear(candidate, pieces)) {
        const nearest = this.findNearestPiece(candidate, pieces)
        return {
          position: this.clampToCanvas(candidate),
          rotation: (Math.random() - 0.5) * 0.3,
          depth: pieces.length,
          attachedTo: nearest?.id,
          attachmentPoint: nearest?.position ?? candidate,
        }
      }
    }

    // Fallback: just grow outward
    return this.organicPlacement('', construction)
  }

  private findOuterPieces(construction: Construction): ConstructionPiece[] {
    const pieces = construction.pieces
    if (pieces.length <= 3) return pieces

    // Find pieces on convex hull (simplified: pieces far from center)
    const { centerOfMass } = construction
    const distances = pieces.map((p) => ({
      piece: p,
      distance: this.distance(p.position, centerOfMass),
    }))

    distances.sort((a, b) => b.distance - a.distance)

    // Return outer third
    return distances.slice(0, Math.max(3, Math.floor(pieces.length / 3))).map((d) => d.piece)
  }

  private findNearestPiece(
    position: Vec2,
    pieces: ConstructionPiece[]
  ): ConstructionPiece | undefined {
    if (pieces.length === 0) return undefined

    let nearest = pieces[0]
    let minDist = this.distance(position, nearest.position)

    for (const piece of pieces) {
      const dist = this.distance(position, piece.position)
      if (dist < minDist) {
        minDist = dist
        nearest = piece
      }
    }

    return nearest
  }

  private isPositionClear(position: Vec2, pieces: ConstructionPiece[]): boolean {
    const minDist = this.config.minPieceDistance ?? 0.03

    for (const piece of pieces) {
      if (this.distance(position, piece.position) < minDist) {
        return false
      }
    }

    return true
  }

  private findSpiralCell(
    occupied: Set<string>,
    gridSize: number
  ): { x: number; y: number } {
    const centerX = Math.floor(0.5 / gridSize)
    const centerY = Math.floor(0.5 / gridSize)

    // Spiral outward from center
    for (let ring = 0; ring < 20; ring++) {
      for (let i = -ring; i <= ring; i++) {
        for (let j = -ring; j <= ring; j++) {
          if (Math.abs(i) === ring || Math.abs(j) === ring) {
            const x = centerX + i
            const y = centerY + j
            if (!occupied.has(`${x},${y}`) && x >= 0 && y >= 0) {
              return { x, y }
            }
          }
        }
      }
    }

    return { x: centerX, y: centerY }
  }

  private findRowByRowCell(
    occupied: Set<string>,
    gridSize: number
  ): { x: number; y: number } {
    const maxX = Math.floor(1 / gridSize)
    const maxY = Math.floor(1 / gridSize)

    for (let y = maxY - 1; y >= 0; y--) {
      for (let x = 0; x < maxX; x++) {
        if (!occupied.has(`${x},${y}`)) {
          return { x, y }
        }
      }
    }

    return { x: 0, y: 0 }
  }

  private findRandomEmptyCell(
    occupied: Set<string>,
    gridSize: number
  ): { x: number; y: number } {
    const maxX = Math.floor(1 / gridSize)
    const maxY = Math.floor(1 / gridSize)

    for (let attempt = 0; attempt < 100; attempt++) {
      const x = Math.floor(Math.random() * maxX)
      const y = Math.floor(Math.random() * maxY)
      if (!occupied.has(`${x},${y}`)) {
        return { x, y }
      }
    }

    return this.findRowByRowCell(occupied, gridSize)
  }

  private clampToCanvas(pos: Vec2): Vec2 {
    const padding = this.config.padding ?? 0.08
    return {
      x: Math.max(padding, Math.min(1 - padding, pos.x)),
      y: Math.max(padding, Math.min(1 - padding, pos.y)),
    }
  }

  private evaluateBezier(
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
    t: number
  ): Vec2 {
    const t2 = t * t
    const t3 = t2 * t
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    }
  }

  private getBezierTangentAngle(
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
    t: number
  ): number {
    const t2 = t * t
    const mt = 1 - t
    const mt2 = mt * mt

    const tangent = {
      x:
        3 * mt2 * (p1.x - p0.x) +
        6 * mt * t * (p2.x - p1.x) +
        3 * t2 * (p3.x - p2.x),
      y:
        3 * mt2 * (p1.y - p0.y) +
        6 * mt * t * (p2.y - p1.y) +
        3 * t2 * (p3.y - p2.y),
    }

    return Math.atan2(tangent.y, tangent.x)
  }

  private distance(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private normalize(v: Vec2): Vec2 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y)
    if (len === 0) return { x: 0, y: -1 }
    return { x: v.x / len, y: v.y / len }
  }

  private dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createPlacementEngine(
  config?: Partial<PlacementEngineConfig>
): PlacementEngine {
  return new PlacementEngine(config)
}
