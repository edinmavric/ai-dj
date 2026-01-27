import React from 'react'
import { RatingChangeData } from '../../../types/websocket'
import styles from './EloChangeDisplay.module.css'

interface EloChangeDisplayProps {
  playerOneChange?: RatingChangeData
  playerTwoChange?: RatingChangeData
  playerOneUsername: string
  playerTwoUsername: string
  isPvP: boolean
}

export const EloChangeDisplay: React.FC<EloChangeDisplayProps> = ({
  playerOneChange,
  playerTwoChange,
  playerOneUsername,
  playerTwoUsername,
  isPvP,
}) => {
  // Only show for PvP games with rating changes
  if (!isPvP || (!playerOneChange && !playerTwoChange)) {
    return null
  }

  const renderRatingChange = (
    change: RatingChangeData | undefined,
    username: string
  ) => {
    if (!change) return null

    const isPositive = change.change >= 0
    const changeClass = isPositive ? styles.positive : styles.negative
    const arrow = isPositive ? '↑' : '↓'
    const sign = isPositive ? '+' : ''

    return (
      <div className={styles.playerRating}>
        <span className={styles.username}>{username}</span>
        <div className={styles.ratingInfo}>
          <span className={styles.ratingValues}>
            {change.old_rating} → {change.new_rating}
          </span>
          <span className={`${styles.change} ${changeClass}`}>
            {arrow} {sign}{change.change}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Rating Changes</h4>
      <div className={styles.changes}>
        {renderRatingChange(playerOneChange, playerOneUsername)}
        {renderRatingChange(playerTwoChange, playerTwoUsername)}
      </div>
    </div>
  )
}

export default EloChangeDisplay
