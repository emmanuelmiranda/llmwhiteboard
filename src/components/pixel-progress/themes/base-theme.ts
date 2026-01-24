/**
 * Base Theme
 *
 * Abstract base class for all themes.
 * Provides common functionality and defines the interface.
 */

import type {
  Construction,
  ConstructionPiece,
  ProgressEvent,
  EventBehavior,
  BuilderState,
  ThemeManifest,
  ThemeCategory,
  PlacementStrategy,
  MergeStyle,
  Vec2,
  AnimationSequence,
  PlacementResult,
  BuilderType,
} from '../types'
import {
  DEFAULT_CATEGORY_BEHAVIORS,
  DEFAULT_BUILDER_STATES,
  type StandardCategory,
} from '../constants'
import type { RenderContext, PieceRenderer, BuilderRenderer } from '../core/Renderer'
import { PlacementEngine } from '../core/PlacementEngine'

// =============================================================================
// BASE THEME
// =============================================================================

export abstract class BaseTheme {
  abstract readonly manifest: ThemeManifest

  protected placementEngine: PlacementEngine

  constructor() {
    this.placementEngine = new PlacementEngine({
      strategy: this.getPlacementStrategy(),
      mergeStyle: this.getDefaultMergeStyle(),
    })
  }

  // ===========================================================================
  // ABSTRACT METHODS (must be implemented by themes)
  // ===========================================================================

  /**
   * Load theme assets (sprites, sounds, etc.)
   */
  abstract load(): Promise<void>

  /**
   * Render a construction piece
   */
  abstract renderPiece: PieceRenderer

  /**
   * Render the builder entity
   */
  abstract renderBuilder: BuilderRenderer

  /**
   * Get the animation sequence for adding a piece
   */
  abstract getPieceAddAnimation(piece: ConstructionPiece): AnimationSequence

  /**
   * Get the celebration animation for completion
   */
  abstract getCompletionAnimation(construction: Construction): AnimationSequence

  // ===========================================================================
  // OVERRIDABLE METHODS (themes can customize)
  // ===========================================================================

  /**
   * Get the placement strategy for this theme
   */
  getPlacementStrategy(): PlacementStrategy {
    return 'organic'
  }

  /**
   * Get the default merge style
   */
  getDefaultMergeStyle(): MergeStyle {
    return 'blend'
  }

  /**
   * Classify an event into a behavior
   */
  classifyEvent(event: ProgressEvent): EventBehavior {
    const category = event.category as StandardCategory
    const defaultBehavior = DEFAULT_CATEGORY_BEHAVIORS[category]
    const defaultBuilderState = DEFAULT_BUILDER_STATES[category]

    if (!defaultBehavior) {
      // Unknown category - treat as animation
      return {
        type: 'animation',
        builderState: 'working',
        duration: 500,
      }
    }

    switch (defaultBehavior.behavior) {
      case 'piece':
        return {
          type: 'piece',
          pieceCategory: category,
          weight: event.weight ?? defaultBehavior.weight,
          builderState: defaultBuilderState,
        }

      case 'animation':
        return {
          type: 'animation',
          builderState: defaultBuilderState,
          loop: category === 'wait',
          duration: 500,
        }

      case 'modifier':
        return {
          type: 'modifier',
          target: 'last',
          modification: {
            action: category === 'cleanup' ? 'remove' : 'enhance',
          },
          builderState: defaultBuilderState,
        }

      default:
        return {
          type: 'animation',
          builderState: 'idle',
        }
    }
  }

  /**
   * Calculate placement for a new piece
   */
  calculatePlacement(
    category: string,
    construction: Construction
  ): PlacementResult {
    return this.placementEngine.calculatePlacement(category, construction)
  }

  /**
   * Get piece color based on category
   */
  getPieceColor(category: string, _variant: number): string {
    const palette = this.manifest.palette
    const hash = this.hashString(category)
    return palette[hash % palette.length]
  }

  /**
   * Get number of visual variants for a category
   */
  getPieceVariants(category: string): number {
    const cat = this.manifest.categories.find((c) => c.id === category)
    return cat?.pieceVariants ?? 4
  }

  /**
   * Render connections between pieces
   */
  renderConnections(
    ctx: RenderContext,
    construction: Construction
  ): void {
    // Default: no visible connections
    // Themes like Circuit would override this
  }

  /**
   * Generate position for a new piece (optional override for themes with custom placement)
   * Return undefined to use default placement logic
   */
  generatePiecePosition(
    category: string,
    existingPieces: ConstructionPiece[]
  ): Vec2 | undefined {
    return undefined
  }

  /**
   * Get piece size for a category (optional override)
   * Return undefined to use default size calculation
   */
  getPieceSize(category: string): number | undefined {
    return undefined
  }

  /**
   * Get builder position for working on construction
   */
  getBuilderWorkPosition(construction: Construction): Vec2 {
    // Default: to the right of the construction
    const bounds = construction.bounds
    return {
      x: Math.min(0.85, bounds.max.x + 0.1),
      y: (bounds.min.y + bounds.max.y) / 2,
    }
  }

  /**
   * Get builder idle animation sequence
   */
  getBuilderIdleAnimation(): AnimationSequence {
    return {
      id: 'idle',
      keyframes: [],
      duration: 2000,
      easing: 'linear',
      loop: true,
    }
  }

  /**
   * Get builder state transition animation
   */
  getBuilderStateAnimation(
    _fromState: BuilderState,
    _toState: BuilderState
  ): AnimationSequence | null {
    return null // No transition animation by default
  }

  /**
   * Called when the construction is reset
   */
  onReset(): void {
    // Override to reset theme state
  }

  /**
   * Dispose of theme resources
   */
  dispose(): void {
    // Override to clean up resources
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  protected hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  protected lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
    return {
      x: this.lerp(a.x, b.x, t),
      y: this.lerp(a.y, b.y, t),
    }
  }
}

// =============================================================================
// THEME REGISTRY
// =============================================================================

const themeRegistry = new Map<string, () => BaseTheme>()

export function registerTheme(id: string, factory: () => BaseTheme): void {
  themeRegistry.set(id, factory)
}

export function getTheme(id: string): BaseTheme | undefined {
  const factory = themeRegistry.get(id)
  return factory?.()
}

export function getThemeIds(): string[] {
  return Array.from(themeRegistry.keys())
}

export function getAllThemeManifests(): ThemeManifest[] {
  return getThemeIds()
    .map((id) => getTheme(id)?.manifest)
    .filter((m): m is ThemeManifest => m !== undefined)
}
