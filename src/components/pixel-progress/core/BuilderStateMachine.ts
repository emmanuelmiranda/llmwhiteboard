/**
 * Builder State Machine
 *
 * Centralized state management for the builder character.
 * Clear states, transitions, and single source of truth.
 */

import type { BuilderState } from '../types'

// =============================================================================
// TYPES
// =============================================================================

export type BuilderEvent =
  | { type: 'USER_PROMPT' }
  | { type: 'TOOL_START'; toolName: string }
  | { type: 'TOOL_COMPLETE'; toolName: string }
  | { type: 'PERMISSION_REQUEST' }
  | { type: 'SESSION_END' }
  | { type: 'INACTIVITY_TIMEOUT' }
  | { type: 'CELEBRATION_COMPLETE' }

export interface BuilderContext {
  pendingTools: Set<string>
  currentAction: string | null  // Current tool being worked on (for bubble)
  lastAction: string | null     // Last completed action (for fading bubble)
  lastActionTime: number        // When last action completed
  hasToolActivity: boolean      // Whether any tool has been used since last USER_PROMPT
}

export interface BuilderStateInfo {
  state: BuilderState
  context: BuilderContext
  bubble: BubbleInfo | null
}

export interface BubbleInfo {
  text: string
  style: 'working' | 'waiting' | 'done' | 'fading'
}

// =============================================================================
// STATE MACHINE
// =============================================================================

export class BuilderStateMachine {
  private state: BuilderState = 'idle'
  private context: BuilderContext = {
    pendingTools: new Set(),
    currentAction: null,
    lastAction: null,
    lastActionTime: 0,
    hasToolActivity: false,
  }

  private onStateChange?: (info: BuilderStateInfo) => void

  constructor(onStateChange?: (info: BuilderStateInfo) => void) {
    this.onStateChange = onStateChange
  }

  /**
   * Get current state info
   */
  getStateInfo(): BuilderStateInfo {
    return {
      state: this.state,
      context: { ...this.context, pendingTools: new Set(this.context.pendingTools) },
      bubble: this.getBubbleInfo(),
    }
  }

  /**
   * Get current bubble info based on state
   */
  private getBubbleInfo(): BubbleInfo | null {
    switch (this.state) {
      case 'working':
        if (this.context.currentAction) {
          return { text: this.context.currentAction, style: 'working' }
        }
        // Check for fading last action
        if (this.context.lastAction && Date.now() - this.context.lastActionTime < 1500) {
          return { text: this.context.lastAction, style: 'fading' }
        }
        return null

      case 'waiting':
        return { text: 'Hey!', style: 'waiting' }

      case 'celebrating':
        return { text: 'Done!', style: 'done' }

      case 'idle':
      default:
        return null
    }
  }

  /**
   * Process an event and transition state
   */
  transition(event: BuilderEvent): BuilderStateInfo {
    const previousState = this.state
    const previousAction = this.context.currentAction
    const previousPendingCount = this.context.pendingTools.size

    switch (event.type) {
      case 'USER_PROMPT':
        // Always go to working on new prompt
        this.state = 'working'
        this.context.currentAction = null
        this.context.lastAction = null
        this.context.hasToolActivity = false  // Reset - no tools used yet for this prompt
        break

      case 'TOOL_START':
        // Add to pending, set current action, ensure working
        this.context.pendingTools.add(event.toolName)
        this.context.currentAction = this.formatToolName(event.toolName)
        this.context.hasToolActivity = true  // Mark that tool activity has occurred
        this.state = 'working'
        break

      case 'TOOL_COMPLETE':
        // Remove from pending, update last action
        this.context.pendingTools.delete(event.toolName)
        this.context.lastAction = this.formatToolName(event.toolName)
        this.context.lastActionTime = Date.now()

        // If more tools pending, show the next one
        if (this.context.pendingTools.size > 0) {
          const nextTool = Array.from(this.context.pendingTools)[0]
          this.context.currentAction = this.formatToolName(nextTool)
        } else {
          this.context.currentAction = null
        }
        // Stay working - we'll go celebrating only on explicit SESSION_END
        this.state = 'working'
        break

      case 'PERMISSION_REQUEST':
        // Pause and wait for user
        this.state = 'waiting'
        this.context.currentAction = null
        break

      case 'SESSION_END':
        // Session explicitly ended
        this.state = 'celebrating'
        this.context.pendingTools.clear()
        this.context.currentAction = null
        break

      case 'INACTIVITY_TIMEOUT':
        // INACTIVITY_TIMEOUT no longer triggers celebration
        // Celebration only happens on explicit SESSION_END (when a block/turn completes)
        // This event is kept for potential future use but does not change state
        break

      case 'CELEBRATION_COMPLETE':
        // Done celebrating, go idle
        this.state = 'idle'
        break
    }

    const info = this.getStateInfo()

    // Always log transitions for debugging
    const stateChanged = this.state !== previousState
    const actionChanged = this.context.currentAction !== previousAction
    const pendingChanged = this.context.pendingTools.size !== previousPendingCount

    console.log(
      `[StateMachine] ${event.type}:`,
      `${previousState} → ${this.state}`,
      stateChanged ? '(STATE CHANGED)' : '',
      `| action: ${previousAction || 'null'} → ${this.context.currentAction || 'null'}`,
      actionChanged ? '(ACTION CHANGED)' : '',
      `| pending: ${previousPendingCount} → ${this.context.pendingTools.size}`,
      `| bubble: ${info.bubble?.text || 'null'} (${info.bubble?.style || 'none'})`
    )

    // Notify listener if state changed
    if (stateChanged || event.type === 'TOOL_START' || event.type === 'TOOL_COMPLETE') {
      this.onStateChange?.(info)
    }

    return info
  }

  /**
   * Check if there are pending tools
   */
  hasPendingTools(): boolean {
    return this.context.pendingTools.size > 0
  }

  /**
   * Check if system is actively working
   */
  isActive(): boolean {
    return this.state === 'working' || this.context.pendingTools.size > 0
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = 'idle'
    this.context = {
      pendingTools: new Set(),
      currentAction: null,
      lastAction: null,
      lastActionTime: 0,
      hasToolActivity: false,
    }
  }

  /**
   * Format tool name for display
   */
  private formatToolName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
}
