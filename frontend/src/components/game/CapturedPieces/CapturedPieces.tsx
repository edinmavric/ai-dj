import React, { useMemo } from 'react'
import { Move } from '../../../types/game'
import styles from './CapturedPieces.module.css'

interface CapturedPiecesProps {
  moves: Move[]
  capturedByPlayer: 1 | 2 // Which player's captures to show
  size?: 'small' | 'medium'
}

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({
  moves,
  capturedByPlayer,
  size = 'small',
}) => {
  // Count captures made by this player
  // Even-indexed moves (0, 2, 4...) are player 1's moves
  // Odd-indexed moves (1, 3, 5...) are player 2's moves
  const captureCount = useMemo(() => {
    return moves.filter((move, index) => {
      const moveByPlayer = index % 2 === 0 ? 1 : 2
      return move.captured && moveByPlayer === capturedByPlayer
    }).length
  }, [moves, capturedByPlayer])

  // The captured pieces belong to the opponent
  const capturedPieceType = capturedByPlayer === 1 ? 2 : 1

  if (captureCount === 0) {
    return (
      <div className={`${styles.container} ${styles[size]}`}>
        <span className={styles.empty}>-</span>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${styles[size]}`}>
      {Array.from({ length: captureCount }).map((_, index) => (
        <div
          key={index}
          className={`${styles.piece} ${capturedPieceType === 1 ? styles.player : styles.ai}`}
        >
          {capturedPieceType === 1 ? (
            // Mini Eleven icon
            <svg viewBox="0 0 40 40" className={styles.icon}>
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <text
                x="20"
                y="25"
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill="currentColor"
              >
                11
              </text>
            </svg>
          ) : (
            // Mini Demogorgon icon
            <svg viewBox="0 0 40 40" className={styles.icon}>
              <path
                d="M20 4 L8 20 L14 20 L10 36 L20 24 L26 24 L30 36 L26 20 L32 20 Z"
                fill="currentColor"
              />
              <circle cx="16" cy="16" r="2" fill="#ff0000" />
              <circle cx="24" cy="16" r="2" fill="#ff0000" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}

export default CapturedPieces
