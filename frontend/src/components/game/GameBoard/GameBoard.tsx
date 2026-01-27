import React, { useMemo, useCallback } from 'react'
import { GameCell } from '../GameCell'
import { GamePiece } from '../GamePiece'
import { Position, GameState, Move } from '../../../types/game'
import styles from './GameBoard.module.css'

interface GameBoardProps {
  gameState: GameState
  onCellClick?: (position: Position) => void
  selectedPosition: Position | null
  validMoves: Move[]
  isPlayerTurn: boolean
  aiThinking?: boolean
  disableOverlays?: boolean  // Disable all overlays (for replay mode, game over)
  isLocalPvP?: boolean  // Local PvP mode (same device, no waiting overlay)
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onCellClick,
  selectedPosition,
  validMoves,
  isPlayerTurn,
  aiThinking = false,
  disableOverlays = false,
  isLocalPvP = false,
}) => {
  const { board } = gameState

  const isValidMoveTarget = useCallback(
    (position: Position): boolean => {
      return validMoves.some(
        (move) => move.to.row === position.row && move.to.col === position.col
      )
    },
    [validMoves]
  )

  const isSelected = useCallback(
    (position: Position): boolean => {
      return (
        selectedPosition !== null &&
        selectedPosition.row === position.row &&
        selectedPosition.col === position.col
      )
    },
    [selectedPosition]
  )

  const isCaptureTarget = useCallback(
    (position: Position): boolean => {
      return validMoves.some(
        (move) =>
          move.to.row === position.row &&
          move.to.col === position.col &&
          move.captured !== undefined
      )
    },
    [validMoves]
  )

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${board.size}, 1fr)`,
      gridTemplateRows: `repeat(${board.size}, 1fr)`,
    }),
    [board.size]
  )

  const boardClasses = [
    styles.board,
    !isPlayerTurn || aiThinking ? styles.disabled : '',
    aiThinking ? styles.aiThinking : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Show overlays only when not disabled (not in replay mode, not game over)
  // Don't show waiting overlay for local PvP (same device, both players take turns)
  const showAiThinkingOverlay = aiThinking && !disableOverlays
  const showWaitingOverlay = !isPlayerTurn && !aiThinking && !disableOverlays && !isLocalPvP

  return (
    <div className={styles.boardContainer}>
      {showAiThinkingOverlay && (
        <div className={styles.thinkingOverlay}>
          <div className={styles.thinkingText}>AI is thinking...</div>
        </div>
      )}
      {showWaitingOverlay && (
        <div className={styles.waitingOverlay}>
          <div className={styles.waitingText}>Opponent's turn</div>
        </div>
      )}
      <div className={boardClasses} style={gridStyle}>
        {board.grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const position: Position = { row: rowIndex, col: colIndex }
            return (
              <GameCell
                key={`${rowIndex}-${colIndex}`}
                position={position}
                isSelected={isSelected(position)}
                isValidTarget={isValidMoveTarget(position)}
                isCapture={isCaptureTarget(position)}
                onClick={() => onCellClick?.(position)}
                disabled={!isPlayerTurn || aiThinking}
              >
                {cell !== 0 && (
                  <GamePiece
                    type={cell as 1 | 2}
                    isSelected={isSelected(position)}
                  />
                )}
              </GameCell>
            )
          })
        )}
      </div>
    </div>
  )
}

export default GameBoard
