import React from 'react'
import { Position } from '../../../types/game'
import styles from './GameCell.module.css'

interface GameCellProps {
  position: Position
  isSelected: boolean
  isValidTarget: boolean
  isCapture: boolean
  onClick: () => void
  disabled?: boolean
  children?: React.ReactNode
}

export const GameCell: React.FC<GameCellProps> = ({
  position,
  isSelected,
  isValidTarget,
  isCapture,
  onClick,
  disabled = false,
  children,
}) => {
  const isDark = (position.row + position.col) % 2 === 1

  const cellClasses = [
    styles.cell,
    isDark ? styles.dark : styles.light,
    isSelected ? styles.selected : '',
    isValidTarget ? styles.validTarget : '',
    isCapture ? styles.captureTarget : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cellClasses}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          onClick()
        }
      }}
      aria-label={`Cell at row ${position.row + 1}, column ${position.col + 1}`}
    >
      {children}
      {isValidTarget && !isCapture && <div className={styles.moveIndicator} />}
      {isCapture && <div className={styles.captureIndicator} />}
    </div>
  )
}

export default GameCell
