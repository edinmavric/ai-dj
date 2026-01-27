import React from 'react'
import styles from './GamePiece.module.css'

interface GamePieceProps {
  type: 1 | 2 // 1 = Player (Eleven), 2 = AI (Demogorgon)
  isSelected?: boolean
}

export const GamePiece: React.FC<GamePieceProps> = ({
  type,
  isSelected = false,
}) => {
  const isPlayer = type === 1

  const pieceClasses = [
    styles.piece,
    isPlayer ? styles.player : styles.ai,
    isSelected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={pieceClasses}>
      <div className={styles.inner}>
        {isPlayer ? (
          // Eleven icon - glowing circle with "11"
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
          // Demogorgon icon - monster face
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
    </div>
  )
}

export default GamePiece
