import { Position, Move } from '../types/game'

/**
 * Convert a position to algebraic notation
 * Column 0 = 'a', Column 1 = 'b', etc.
 * Row 0 = '1', Row 1 = '2', etc. (1-indexed in display)
 */
export function positionToAlgebraic(pos: Position, boardSize: number = 5): string {
  const col = String.fromCharCode(97 + pos.col) // 97 = 'a'
  const row = boardSize - pos.row // Flip so bottom row is 1
  return `${col}${row}`
}

/**
 * Convert a move to algebraic notation
 * Format: "a1-b2" or "a1×c3" (× for captures)
 */
export function moveToNotation(move: Move, boardSize: number = 5): string {
  const from = positionToAlgebraic(move.from, boardSize)
  const to = positionToAlgebraic(move.to, boardSize)
  const separator = move.captured ? '×' : '-'
  return `${from}${separator}${to}`
}

/**
 * Format move number for display (e.g., "1." or "1...")
 */
export function formatMoveNumber(moveIndex: number): string {
  const turnNumber = Math.floor(moveIndex / 2) + 1
  return `${turnNumber}.`
}

/**
 * Check if a move belongs to player 1 (even indices) or player 2 (odd indices)
 */
export function getMovePlayer(moveIndex: number): 1 | 2 {
  return moveIndex % 2 === 0 ? 1 : 2
}
