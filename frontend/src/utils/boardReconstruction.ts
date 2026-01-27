import { Move } from '../types/game'

/**
 * Creates the initial board setup for the game.
 * Matches backend board.py:create_initial_board
 * Player 1 (human) starts on the LEFT column (col 0)
 * Player 2 (AI/opponent) starts on the RIGHT column (col size-1)
 * Middle row is left empty on both sides
 */
export function createInitialBoard(size: number = 5): number[][] {
  const board: number[][] = []
  const middleRow = Math.floor(size / 2)

  for (let row = 0; row < size; row++) {
    const boardRow: number[] = []
    for (let col = 0; col < size; col++) {
      if (col === 0 && row !== middleRow) {
        // Left column (except middle): Player 1
        boardRow.push(1)
      } else if (col === size - 1 && row !== middleRow) {
        // Right column (except middle): Player 2
        boardRow.push(2)
      } else {
        // Everything else: empty
        boardRow.push(0)
      }
    }
    board.push(boardRow)
  }

  return board
}

/**
 * Applies a single move to a board state, returning a new board.
 * Does not mutate the original board.
 */
export function applyMoveToBoard(
  board: number[][],
  move: Move,
  player: 1 | 2
): number[][] {
  // Deep copy the board
  const newBoard = board.map(row => [...row])

  // Move the piece
  newBoard[move.to.row][move.to.col] = player
  newBoard[move.from.row][move.from.col] = 0

  // Handle capture
  if (move.captured) {
    newBoard[move.captured.row][move.captured.col] = 0
  }

  return newBoard
}

/**
 * Reconstructs the board state at a specific move index.
 * Index 0 = state after first move
 * Index -1 = initial state (no moves applied)
 *
 * @param size - Board size (default 5x5)
 * @param moves - Array of all moves in the game
 * @param upToIndex - The move index to reconstruct up to (inclusive)
 * @returns The board grid at that point in the game
 */
export function reconstructBoardAtMove(
  size: number,
  moves: Move[],
  upToIndex: number
): number[][] {
  // Start with initial board
  let board = createInitialBoard(size)

  // If upToIndex is -1, return initial state
  if (upToIndex < 0) {
    return board
  }

  // Apply moves up to and including the specified index
  const movesToApply = Math.min(upToIndex + 1, moves.length)

  for (let i = 0; i < movesToApply; i++) {
    // Player 1 moves on even indices (0, 2, 4, ...)
    // Player 2 moves on odd indices (1, 3, 5, ...)
    const player: 1 | 2 = (i % 2 === 0) ? 1 : 2
    board = applyMoveToBoard(board, moves[i], player)
  }

  return board
}

/**
 * Gets the current player at a specific move index.
 * Returns who just moved (for display purposes).
 */
export function getPlayerAtMove(moveIndex: number): 1 | 2 {
  return (moveIndex % 2 === 0) ? 1 : 2
}

/**
 * Gets the turn number at a specific move index.
 */
export function getTurnNumberAtMove(moveIndex: number): number {
  return Math.floor(moveIndex / 2) + 1
}
