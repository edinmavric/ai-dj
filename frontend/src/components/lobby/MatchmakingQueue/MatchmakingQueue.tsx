import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './MatchmakingQueue.module.css'

interface QueueState {
  inQueue: boolean
  queueType: string | null
  position: number
  playersWaiting: number
}

interface MatchFoundData {
  game_id: string
  opponent: string
}

interface MatchmakingQueueProps {
  queueState: QueueState
  matchFound: MatchFoundData | null
  onJoinQueue: () => void
  onLeaveQueue: () => void
  onClearMatch: () => void
  isConnected: boolean
  disabled?: boolean
}

export const MatchmakingQueue: React.FC<MatchmakingQueueProps> = ({
  queueState,
  matchFound,
  onJoinQueue,
  onLeaveQueue,
  onClearMatch,
  isConnected,
  disabled = false,
}) => {
  const navigate = useNavigate()

  // Auto-navigate when match is found
  useEffect(() => {
    if (matchFound) {
      const timer = setTimeout(() => {
        onClearMatch()
        navigate(`/game/${matchFound.game_id}`)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [matchFound, navigate, onClearMatch])

  if (matchFound) {
    return (
      <div className={styles.container}>
        <div className={styles.matchFound}>
          <div className={styles.matchIcon}>🎮</div>
          <h3 className={styles.matchTitle}>Match Found!</h3>
          <p className={styles.matchOpponent}>vs {matchFound.opponent}</p>
          <p className={styles.matchRedirect}>Redirecting to game...</p>
        </div>
      </div>
    )
  }

  if (queueState.inQueue) {
    return (
      <div className={styles.container}>
        <div className={styles.searching}>
          <div className={styles.spinner}></div>
          <h3 className={styles.searchTitle}>Searching for opponent...</h3>
          <p className={styles.queueInfo}>
            {queueState.playersWaiting} player{queueState.playersWaiting !== 1 ? 's' : ''} in queue
          </p>
          <button className={styles.cancelButton} onClick={onLeaveQueue}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.findMatchButton}
        onClick={onJoinQueue}
        disabled={disabled || !isConnected}
      >
        {!isConnected ? 'Connecting...' : 'Find Match'}
      </button>
      {!isConnected && (
        <p className={styles.connectingInfo}>Connecting to matchmaking server...</p>
      )}
    </div>
  )
}

export default MatchmakingQueue
