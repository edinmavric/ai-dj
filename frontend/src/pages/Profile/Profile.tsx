import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { userApi, UserStats, GameRecord } from '../../api/user'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Profile.module.css'

type TimeCategory = 'bullet' | 'blitz' | 'rapid'
type GameMode = 'pvp' | 'pve'

export const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>()
  const { user: currentUser } = useAuth()

  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [games, setGames] = useState<GameRecord[]>([])
  const [activeTab, setActiveTab] = useState<TimeCategory>('blitz')
  const [activeMode, setActiveMode] = useState<GameMode>('pvp')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwnProfile = currentUser?.id === userId

  const fetchUserData = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const [statsData, gamesData] = await Promise.all([
        userApi.getUserStats(userId),
        userApi.getUserGames(userId),
      ])
      setUserStats(statsData)
      setGames(gamesData)
    } catch (err) {
      setError('Failed to load profile')
      console.error('Failed to fetch profile:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  const getWinRate = (mode: GameMode): string => {
    if (!userStats) return '0%'
    if (mode === 'pve') {
      if (userStats.user.pve_games_played === 0) return '0%'
      return `${Math.round((userStats.user.pve_games_won / userStats.user.pve_games_played) * 100)}%`
    }
    if (userStats.user.games_played === 0) return '0%'
    return `${Math.round((userStats.user.games_won / userStats.user.games_played) * 100)}%`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRatingHistory = () => {
    if (!userStats) return []
    const modeHistory = userStats.rating_history[activeMode]
    if (!modeHistory) return []
    return modeHistory[activeTab] || []
  }

  const getEloForCategory = (mode: GameMode, category: TimeCategory): number => {
    if (!userStats) return 1200
    if (mode === 'pve') {
      switch (category) {
        case 'bullet': return userStats.user.elo_bullet_pve || 1200
        case 'blitz': return userStats.user.elo_blitz_pve || 1200
        case 'rapid': return userStats.user.elo_rapid_pve || 1200
      }
    }
    switch (category) {
      case 'bullet': return userStats.user.elo_bullet
      case 'blitz': return userStats.user.elo_blitz
      case 'rapid': return userStats.user.elo_rapid
    }
  }

  const getGamesPlayed = (mode: GameMode): number => {
    if (!userStats) return 0
    return mode === 'pve' ? userStats.user.pve_games_played : userStats.user.games_played
  }

  const getGamesWon = (mode: GameMode): number => {
    if (!userStats) return 0
    return mode === 'pve' ? userStats.user.pve_games_won : userStats.user.games_won
  }

  const getGamesLost = (mode: GameMode): number => {
    if (!userStats) return 0
    return mode === 'pve' ? userStats.user.pve_games_lost : userStats.user.games_lost
  }

  const getGameResult = (game: GameRecord): { result: string; className: string } => {
    if (!userId) return { result: '-', className: '' }

    if (game.mode === 'pve') {
      if (game.ai_won) {
        return { result: 'Loss', className: styles.loss }
      }
      return { result: 'Win', className: styles.win }
    }

    if (game.winner?.id === userId) {
      return { result: 'Win', className: styles.win }
    }
    if (game.winner) {
      return { result: 'Loss', className: styles.loss }
    }
    return { result: 'Draw', className: styles.draw }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !userStats) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Profile Not Found</h2>
          <p>{error || 'The requested profile does not exist.'}</p>
          <Link to="/" className={styles.homeLink}>
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  const { user } = userStats

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <Link to="/leaderboard" className={styles.backLink}>
            &larr; Back to Leaderboard
          </Link>
        </header>

        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h1 className={styles.username}>
            {user.username}
            {isOwnProfile && <span className={styles.youBadge}>You</span>}
          </h1>
          <p className={styles.joinDate}>
            Member since {formatDate(user.created_at)}
          </p>
        </div>

        {/* Game Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeButton} ${activeMode === 'pvp' ? styles.active : ''}`}
            onClick={() => setActiveMode('pvp')}
          >
            PvP Stats
          </button>
          <button
            className={`${styles.modeButton} ${activeMode === 'pve' ? styles.active : ''}`}
            onClick={() => setActiveMode('pve')}
          >
            PvE Stats
          </button>
        </div>

        <div className={styles.ratingCards}>
          <div
            className={`${styles.ratingCard} ${activeTab === 'bullet' ? styles.active : ''}`}
            onClick={() => setActiveTab('bullet')}
          >
            <span className={styles.ratingLabel}>Bullet</span>
            <span className={styles.ratingValue}>{getEloForCategory(activeMode, 'bullet')}</span>
          </div>
          <div
            className={`${styles.ratingCard} ${activeTab === 'blitz' ? styles.active : ''}`}
            onClick={() => setActiveTab('blitz')}
          >
            <span className={styles.ratingLabel}>Blitz</span>
            <span className={styles.ratingValue}>{getEloForCategory(activeMode, 'blitz')}</span>
          </div>
          <div
            className={`${styles.ratingCard} ${activeTab === 'rapid' ? styles.active : ''}`}
            onClick={() => setActiveTab('rapid')}
          >
            <span className={styles.ratingLabel}>Rapid</span>
            <span className={styles.ratingValue}>{getEloForCategory(activeMode, 'rapid')}</span>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{getGamesPlayed(activeMode)}</span>
            <span className={styles.statLabel}>Games Played</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statValue} ${styles.wins}`}>{getGamesWon(activeMode)}</span>
            <span className={styles.statLabel}>Wins</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statValue} ${styles.losses}`}>{getGamesLost(activeMode)}</span>
            <span className={styles.statLabel}>Losses</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{getWinRate(activeMode)}</span>
            <span className={styles.statLabel}>Win Rate</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Rating History ({activeMode.toUpperCase()} {activeTab})
          </h2>
          {getRatingHistory().length === 0 ? (
            <div className={styles.emptyHistory}>
              No rating history for {activeTab} games yet
            </div>
          ) : (
            <div className={styles.historyList}>
              {getRatingHistory().slice(0, 10).map((entry, index) => (
                <div key={entry.id || index} className={styles.historyItem}>
                  <span className={styles.historyDate}>
                    {formatDate(entry.timestamp)}
                  </span>
                  <span className={styles.historyRating}>{entry.rating}</span>
                  <span
                    className={`${styles.historyChange} ${
                      entry.change > 0 ? styles.positive : entry.change < 0 ? styles.negative : ''
                    }`}
                  >
                    {entry.change > 0 ? '+' : ''}{entry.change}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Games</h2>
          {games.length === 0 ? (
            <div className={styles.emptyGames}>No games played yet</div>
          ) : (
            <div className={styles.gamesList}>
              {games.slice(0, 10).map((game) => {
                const { result, className } = getGameResult(game)
                const opponent =
                  game.mode === 'pve'
                    ? 'AI'
                    : game.player_one?.id === userId
                    ? game.player_two?.username || 'Unknown'
                    : game.player_one?.username || 'Unknown'

                return (
                  <div key={game.id} className={styles.gameItem}>
                    <span className={`${styles.gameResult} ${className}`}>
                      {result}
                    </span>
                    <span className={styles.gameOpponent}>vs {opponent}</span>
                    <span className={styles.gameMode}>
                      {game.time_control === 'unlimited' ? 'Unlimited' : game.time_control}
                    </span>
                    <span className={styles.gameDate}>
                      {formatDate(game.completed_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Profile
