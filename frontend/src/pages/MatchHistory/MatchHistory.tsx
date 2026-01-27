import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api'
import { GameSession, TimeControlCategory } from '../../types/game'
import styles from './MatchHistory.module.css'

interface GameListResponse {
  results?: GameSession[]
  count?: number
}

const TIME_CONTROL_LABELS: Record<TimeControlCategory, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  unlimited: 'Unlimited',
}

export const MatchHistory: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [games, setGames] = useState<GameSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGames = async () => {
      if (!isAuthenticated) {
        setIsLoading(false)
        return
      }

      try {
        const response = await api.listGames() as GameListResponse
        // Filter to completed games and sort by date
        const completedGames = (response.results || response as unknown as GameSession[])
          .filter((game: GameSession) => game.status === 'completed')
          .sort((a: GameSession, b: GameSession) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        setGames(completedGames)
      } catch (err) {
        console.error('Failed to fetch games:', err)
        setError('Failed to load match history')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGames()
  }, [isAuthenticated])

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getGameResult = (game: GameSession): { text: string; className: string } => {
    if (game.mode === 'pve') {
      if (game.ai_won) {
        return { text: 'Loss', className: styles.loss }
      }
      return { text: 'Win', className: styles.win }
    }

    // PvP game
    if (game.player_one_id === user?.id) {
      // User was player 1
      const userWon = game.game_state?.winner === 1
      return userWon
        ? { text: 'Win', className: styles.win }
        : { text: 'Loss', className: styles.loss }
    } else {
      // User was player 2
      const userWon = game.game_state?.winner === 2
      return userWon
        ? { text: 'Win', className: styles.win }
        : { text: 'Loss', className: styles.loss }
    }
  }

  const getOpponentName = (game: GameSession): string => {
    if (game.mode === 'pve') {
      return 'AI'
    }
    if (game.player_one_id === user?.id) {
      return game.player_two_username || 'Player 2'
    }
    return game.player_one_username || 'Player 1'
  }

  const getMoveCount = (game: GameSession): number => {
    return game.game_state?.move_history?.length || 0
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.loginPrompt}>
          <h2>Match History</h2>
          <p>Please sign in to view your match history.</p>
          <Link to="/login" className={styles.loginLink}>Sign In</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading match history...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/" className={styles.backLink}>
          &larr; Back to Home
        </Link>
        <h1 className={styles.title}>Match History</h1>
        <p className={styles.subtitle}>View and replay your past games</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {games.length === 0 ? (
        <div className={styles.empty}>
          <p>No completed games yet.</p>
          <Link to="/" className={styles.playLink}>Play your first game</Link>
        </div>
      ) : (
        <div className={styles.gameList}>
          {games.map((game) => {
            const result = getGameResult(game)
            return (
              <div
                key={game.id}
                className={styles.gameCard}
                onClick={() => navigate(`/game/${game.id}`)}
              >
                <div className={styles.gameInfo}>
                  <div className={styles.gameMode}>
                    <span className={styles.modeLabel}>
                      {game.mode === 'pve' ? 'vs AI' : 'vs Player'}
                    </span>
                    {game.time_control && game.time_control !== 'unlimited' && (
                      <span className={styles.timeControl}>
                        {TIME_CONTROL_LABELS[game.time_control]}
                      </span>
                    )}
                  </div>
                  <div className={styles.opponent}>
                    vs {getOpponentName(game)}
                  </div>
                  <div className={styles.details}>
                    <span>{getMoveCount(game)} moves</span>
                    <span className={styles.dot}>•</span>
                    <span>{game.board_size}x{game.board_size}</span>
                  </div>
                </div>

                <div className={styles.gameResult}>
                  <span className={`${styles.resultBadge} ${result.className}`}>
                    {result.text}
                  </span>
                  <span className={styles.date}>{formatDate(game.created_at)}</span>
                </div>

                <div className={styles.replayHint}>
                  Click to replay
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MatchHistory
