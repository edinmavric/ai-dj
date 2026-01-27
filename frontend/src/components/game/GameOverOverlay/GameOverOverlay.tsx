import React from 'react'
import { GameOverMessage, RatingChangeData } from '../../../types/websocket'
import { TimeControlCategory } from '../../../types/game'
import styles from './GameOverOverlay.module.css'

interface GameOverOverlayProps {
  gameOver: GameOverMessage
  gameMode: 'pve' | 'pvp'
  pvpType: 'local' | 'online_ranked' | 'online_unranked' | null
  timeControl: TimeControlCategory | null
  difficulty?: number
  playerOneUsername: string
  playerTwoUsername: string
  playerRatingChange?: RatingChangeData | null
  onRematch: () => void
  onNewGame: () => void
}

const TIME_CONTROL_LABELS: Record<TimeControlCategory, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  unlimited: 'Unlimited',
}

const AI_INFO: Record<number, { character: string; rating: number }> = {
  1: { character: 'Demogorgon', rating: 600 },
  2: { character: 'Alpha AI', rating: 1000 },
  3: { character: 'Shadow Monster', rating: 1400 },
  4: { character: 'Mind Flayer', rating: 1800 },
}

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  gameOver,
  gameMode,
  pvpType,
  timeControl,
  difficulty = 1,
  playerOneUsername,
  playerTwoUsername,
  playerRatingChange,
  onRematch,
  onNewGame,
}) => {
  const isPvP = gameMode === 'pvp'
  const isRanked = isPvP ? pvpType === 'online_ranked' : true // PvE is always ranked
  const aiInfo = AI_INFO[difficulty] || AI_INFO[1]

  // Determine winner display
  const getWinnerText = (): string => {
    if (isPvP) {
      return gameOver.winner === 1 ? `${playerOneUsername} wins!` : `${playerTwoUsername} wins!`
    }
    return gameOver.ai_won ? `${aiInfo.character} wins!` : 'Victory!'
  }

  // Did the current player (player 1) win?
  const playerWon = isPvP ? gameOver.winner === 1 : !gameOver.ai_won

  // Get time control label
  const getTimeControlLabel = (): string => {
    if (!timeControl || timeControl === 'unlimited') return ''
    return TIME_CONTROL_LABELS[timeControl]
  }

  // Get game type label
  const getGameTypeLabel = (): string => {
    if (isPvP) {
      if (pvpType === 'local') return 'Local Game'
      if (pvpType === 'online_ranked') return 'Ranked'
      if (pvpType === 'online_unranked') return 'Casual'
    }
    return `vs ${aiInfo.character} (${aiInfo.rating})`
  }

  // Get reason text
  const getReasonText = (): string => {
    switch (gameOver.reason) {
      case 'capture':
        return 'All pieces captured'
      case 'timeout':
        return 'Time ran out'
      case 'forfeit':
        return 'Opponent forfeited'
      default:
        return ''
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Result */}
        <div className={`${styles.result} ${playerWon ? styles.win : styles.lose}`}>
          {getWinnerText()}
        </div>

        {/* Reason */}
        {gameOver.reason && (
          <div className={styles.reason}>{getReasonText()}</div>
        )}

        {/* Game Info */}
        <div className={styles.gameInfo}>
          {getTimeControlLabel() && (
            <span className={styles.badge}>{getTimeControlLabel()}</span>
          )}
          <span className={styles.badge}>{getGameTypeLabel()}</span>
        </div>

        {/* ELO Change - only for ranked games */}
        {isRanked && playerRatingChange && (
          <div className={styles.eloSection}>
            <div className={styles.eloLabel}>Rating Change</div>
            <div className={`${styles.eloChange} ${playerRatingChange.change >= 0 ? styles.eloGain : styles.eloLoss}`}>
              {playerRatingChange.change >= 0 ? '+' : ''}{playerRatingChange.change}
            </div>
            <div className={styles.eloDetail}>
              {playerRatingChange.old_rating} → {playerRatingChange.new_rating}
            </div>
          </div>
        )}

        {/* Unranked message */}
        {!isRanked && isPvP && (
          <div className={styles.unrankedMessage}>
            Rating not affected (unranked game)
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.rematchButton} onClick={onRematch}>
            Rematch
          </button>
          <button className={styles.newGameButton} onClick={onNewGame}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameOverOverlay
