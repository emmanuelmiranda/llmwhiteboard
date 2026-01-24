/**
 * Sprite Manager
 *
 * Handles loading, caching, and rendering of sprite sheets.
 * Supports animated sprites with frame-based animation.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SpriteSheet {
  id: string
  image: HTMLImageElement
  frameWidth: number
  frameHeight: number
  frameCount: number
  columns: number
  rows: number
  animations: Record<string, SpriteAnimation>
}

export interface SpriteAnimation {
  name: string
  frames: number[] // Frame indices
  frameDuration: number // ms per frame
  loop: boolean
}

export interface SpriteDefinition {
  id: string
  src: string
  frameWidth: number
  frameHeight: number
  animations?: Record<
    string,
    {
      frames: number[]
      frameDuration: number
      loop?: boolean
    }
  >
}

export interface DrawSpriteOptions {
  x: number
  y: number
  frame?: number
  animation?: string
  animationTime?: number
  scale?: number
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  opacity?: number
  tint?: string
}

// =============================================================================
// SPRITE MANAGER
// =============================================================================

export class SpriteManager {
  private sprites: Map<string, SpriteSheet> = new Map()
  private loadPromises: Map<string, Promise<SpriteSheet>> = new Map()

  /**
   * Load a sprite sheet
   */
  async load(definition: SpriteDefinition): Promise<SpriteSheet> {
    // Return cached if exists
    if (this.sprites.has(definition.id)) {
      return this.sprites.get(definition.id)!
    }

    // Return in-flight promise if loading
    if (this.loadPromises.has(definition.id)) {
      return this.loadPromises.get(definition.id)!
    }

    // Start loading
    const promise = this.loadSpriteSheet(definition)
    this.loadPromises.set(definition.id, promise)

    try {
      const sprite = await promise
      this.sprites.set(definition.id, sprite)
      return sprite
    } finally {
      this.loadPromises.delete(definition.id)
    }
  }

  /**
   * Load multiple sprite sheets
   */
  async loadAll(definitions: SpriteDefinition[]): Promise<void> {
    await Promise.all(definitions.map((def) => this.load(def)))
  }

  /**
   * Get a loaded sprite sheet
   */
  get(id: string): SpriteSheet | undefined {
    return this.sprites.get(id)
  }

  /**
   * Check if sprite is loaded
   */
  has(id: string): boolean {
    return this.sprites.has(id)
  }

  /**
   * Draw a sprite to canvas
   */
  draw(
    ctx: CanvasRenderingContext2D,
    spriteId: string,
    options: DrawSpriteOptions
  ): void {
    const sprite = this.sprites.get(spriteId)
    if (!sprite) {
      console.warn(`Sprite not found: ${spriteId}`)
      return
    }

    let frame = options.frame ?? 0

    // Get frame from animation if specified
    if (options.animation && options.animationTime !== undefined) {
      const anim = sprite.animations[options.animation]
      if (anim) {
        const totalDuration = anim.frames.length * anim.frameDuration
        let time = options.animationTime

        if (anim.loop) {
          time = time % totalDuration
        } else {
          time = Math.min(time, totalDuration - 1)
        }

        const frameIndex = Math.floor(time / anim.frameDuration)
        frame = anim.frames[Math.min(frameIndex, anim.frames.length - 1)]
      }
    }

    // Calculate source rectangle
    const col = frame % sprite.columns
    const row = Math.floor(frame / sprite.columns)
    const sx = col * sprite.frameWidth
    const sy = row * sprite.frameHeight

    // Apply transformations
    ctx.save()

    ctx.translate(options.x, options.y)

    if (options.rotation) {
      ctx.rotate(options.rotation)
    }

    const scale = options.scale ?? 1
    let scaleX = scale
    let scaleY = scale

    if (options.flipX) scaleX *= -1
    if (options.flipY) scaleY *= -1

    ctx.scale(scaleX, scaleY)

    if (options.opacity !== undefined) {
      ctx.globalAlpha = options.opacity
    }

    // Draw centered
    const drawX = -sprite.frameWidth / 2
    const drawY = -sprite.frameHeight / 2

    // Apply tint if specified (simplified - just overlay)
    if (options.tint) {
      // Draw sprite
      ctx.drawImage(
        sprite.image,
        sx,
        sy,
        sprite.frameWidth,
        sprite.frameHeight,
        drawX,
        drawY,
        sprite.frameWidth,
        sprite.frameHeight
      )

      // Overlay tint
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = options.tint
      ctx.fillRect(drawX, drawY, sprite.frameWidth, sprite.frameHeight)
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.drawImage(
        sprite.image,
        sx,
        sy,
        sprite.frameWidth,
        sprite.frameHeight,
        drawX,
        drawY,
        sprite.frameWidth,
        sprite.frameHeight
      )
    }

    ctx.restore()
  }

  /**
   * Get current frame for an animation
   */
  getAnimationFrame(
    spriteId: string,
    animationName: string,
    time: number
  ): number {
    const sprite = this.sprites.get(spriteId)
    if (!sprite) return 0

    const anim = sprite.animations[animationName]
    if (!anim) return 0

    const totalDuration = anim.frames.length * anim.frameDuration
    let t = time

    if (anim.loop) {
      t = t % totalDuration
    } else {
      t = Math.min(t, totalDuration - 1)
    }

    const frameIndex = Math.floor(t / anim.frameDuration)
    return anim.frames[Math.min(frameIndex, anim.frames.length - 1)]
  }

  /**
   * Check if animation is complete (for non-looping animations)
   */
  isAnimationComplete(
    spriteId: string,
    animationName: string,
    time: number
  ): boolean {
    const sprite = this.sprites.get(spriteId)
    if (!sprite) return true

    const anim = sprite.animations[animationName]
    if (!anim) return true
    if (anim.loop) return false

    const totalDuration = anim.frames.length * anim.frameDuration
    return time >= totalDuration
  }

  /**
   * Get animation duration
   */
  getAnimationDuration(spriteId: string, animationName: string): number {
    const sprite = this.sprites.get(spriteId)
    if (!sprite) return 0

    const anim = sprite.animations[animationName]
    if (!anim) return 0

    return anim.frames.length * anim.frameDuration
  }

  /**
   * Unload a sprite
   */
  unload(id: string): void {
    this.sprites.delete(id)
  }

  /**
   * Unload all sprites
   */
  clear(): void {
    this.sprites.clear()
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private async loadSpriteSheet(definition: SpriteDefinition): Promise<SpriteSheet> {
    const image = await this.loadImage(definition.src)

    const columns = Math.floor(image.width / definition.frameWidth)
    const rows = Math.floor(image.height / definition.frameHeight)
    const frameCount = columns * rows

    // Convert animation definitions
    const animations: Record<string, SpriteAnimation> = {}
    if (definition.animations) {
      for (const [name, anim] of Object.entries(definition.animations)) {
        animations[name] = {
          name,
          frames: anim.frames,
          frameDuration: anim.frameDuration,
          loop: anim.loop ?? true,
        }
      }
    }

    return {
      id: definition.id,
      image,
      frameWidth: definition.frameWidth,
      frameHeight: definition.frameHeight,
      frameCount,
      columns,
      rows,
      animations,
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      img.src = src
    })
  }
}

// =============================================================================
// PROCEDURAL SPRITE GENERATION
// =============================================================================

/**
 * Generate simple procedural sprites for themes without assets
 */
export class ProceduralSpriteGenerator {
  /**
   * Generate a simple colored shape sprite
   */
  static generateShape(
    type: 'square' | 'circle' | 'diamond' | 'triangle',
    size: number,
    color: string,
    outlineColor?: string
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = color

    const half = size / 2
    const padding = 2

    switch (type) {
      case 'square':
        ctx.fillRect(padding, padding, size - padding * 2, size - padding * 2)
        break

      case 'circle':
        ctx.beginPath()
        ctx.arc(half, half, half - padding, 0, Math.PI * 2)
        ctx.fill()
        break

      case 'diamond':
        ctx.beginPath()
        ctx.moveTo(half, padding)
        ctx.lineTo(size - padding, half)
        ctx.lineTo(half, size - padding)
        ctx.lineTo(padding, half)
        ctx.closePath()
        ctx.fill()
        break

      case 'triangle':
        ctx.beginPath()
        ctx.moveTo(half, padding)
        ctx.lineTo(size - padding, size - padding)
        ctx.lineTo(padding, size - padding)
        ctx.closePath()
        ctx.fill()
        break
    }

    if (outlineColor) {
      ctx.strokeStyle = outlineColor
      ctx.lineWidth = 1
      ctx.stroke()
    }

    return canvas
  }

  /**
   * Generate a brush stroke sprite
   */
  static generateBrushStroke(
    width: number,
    height: number,
    color: string,
    variation: number = 0
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = color

    // Create organic brush stroke shape
    const points: { x: number; y: number }[] = []
    const segments = 8 + Math.floor(variation * 4)

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = t * width
      const baseY = height / 2
      const wave = Math.sin(t * Math.PI) * (height / 3)
      const noise = (Math.random() - 0.5) * (height / 6) * variation
      points.push({ x, y: baseY - wave + noise })
    }

    // Draw top edge
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }

    // Draw bottom edge (mirrored with variation)
    for (let i = points.length - 1; i >= 0; i--) {
      const y = height - points[i].y + (Math.random() - 0.5) * 4
      ctx.lineTo(points[i].x, y)
    }

    ctx.closePath()
    ctx.fill()

    return canvas
  }

  /**
   * Generate a simple character sprite (stick figure style)
   */
  static generateCharacter(
    size: number,
    bodyColor: string,
    accentColor: string
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const unit = size / 16

    // Head
    ctx.fillStyle = bodyColor
    ctx.fillRect(6 * unit, 1 * unit, 4 * unit, 4 * unit)

    // Body
    ctx.fillRect(6 * unit, 5 * unit, 4 * unit, 5 * unit)

    // Arms
    ctx.fillRect(3 * unit, 5 * unit, 3 * unit, 2 * unit)
    ctx.fillRect(10 * unit, 5 * unit, 3 * unit, 2 * unit)

    // Legs
    ctx.fillRect(6 * unit, 10 * unit, 2 * unit, 5 * unit)
    ctx.fillRect(8 * unit, 10 * unit, 2 * unit, 5 * unit)

    // Eyes
    ctx.fillStyle = accentColor
    ctx.fillRect(7 * unit, 3 * unit, 1 * unit, 1 * unit)
    ctx.fillRect(9 * unit, 3 * unit, 1 * unit, 1 * unit)

    return canvas
  }

  /**
   * Generate a gear/cog sprite
   */
  static generateGear(
    size: number,
    color: string,
    teeth: number = 8
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const center = size / 2
    const outerRadius = size / 2 - 2
    const innerRadius = outerRadius * 0.6
    const toothDepth = outerRadius * 0.25

    ctx.fillStyle = color
    ctx.beginPath()

    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i * Math.PI) / teeth
      const radius = i % 2 === 0 ? outerRadius : outerRadius - toothDepth

      const x = center + Math.cos(angle) * radius
      const y = center + Math.sin(angle) * radius

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.closePath()
    ctx.fill()

    // Center hole
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(center, center, innerRadius * 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    return canvas
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createSpriteManager(): SpriteManager {
  return new SpriteManager()
}
