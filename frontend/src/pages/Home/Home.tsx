import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '../../components/common'
import { OnlinePlayersPanel, MatchmakingQueue } from '../../components/lobby'
import { useAuth } from '../../contexts/AuthContext'
import { useLobby } from '../../hooks/useLobby'
import { api } from '../../api'
import { TimeControlCategory, DifficultyLevel, GameMode } from '../../types/game'
import styles from './Home.module.css'

type BoardSize = 5 | 6 | 7 | 8
type PvPType = 'local' | 'online_ranked' | 'online_unranked'

interface TimePreset {
  name: string
  initial: number
  increment: number
}

const TIME_PRESETS: Record<Exclude<TimeControlCategory, 'unlimited'>, TimePreset[]> = {
  bullet: [
    { name: '1 min', initial: 60, increment: 0 },
    { name: '1+1', initial: 60, increment: 1 },
    { name: '2+1', initial: 120, increment: 1 },
  ],
  blitz: [
    { name: '3 min', initial: 180, increment: 0 },
    { name: '3+2', initial: 180, increment: 2 },
    { name: '5 min', initial: 300, increment: 0 },
    { name: '5+3', initial: 300, increment: 3 },
  ],
  rapid: [
    { name: '10 min', initial: 600, increment: 0 },
    { name: '15+10', initial: 900, increment: 10 },
    { name: '30 min', initial: 1800, increment: 0 },
  ],
}

const DIFFICULTIES: Array<{ value: DifficultyLevel; name: string; character: string; rating: number }> = [
  { value: 1, name: 'Easy', character: 'Demogorgon', rating: 600 },
  { value: 2, name: 'Medium', character: 'Alpha AI', rating: 1000 },
  { value: 3, name: 'Hard', character: 'Shadow Monster', rating: 1400 },
  { value: 4, name: 'Nightmare', character: 'Mind Flayer', rating: 1800 },
]

export const Home: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, refreshUserData } = useAuth()
  const [mode, setMode] = useState<GameMode>('pve')
  const [pvpType, setPvpType] = useState<PvPType>('local')
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(1)
  const [boardSize, setBoardSize] = useState<BoardSize>(5)
  const [timeCategory, setTimeCategory] = useState<TimeControlCategory>('blitz')
  const [selectedPreset, setSelectedPreset] = useState<TimePreset | null>(TIME_PRESETS.blitz[2]) // 5 min default
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lobby hook for online matchmaking (only connect when authenticated)
  const {
    isConnected: lobbyConnected,
    onlinePlayers,
    onlineCount,
    queueState,
    matchFound,
    joinQueue,
    leaveQueue,
    clearMatchFound,
  } = useLobby(isAuthenticated)

  // Refresh user data on mount (to get updated ELO after games)
  useEffect(() => {
    if (isAuthenticated) {
      refreshUserData()
    }
  }, [isAuthenticated, refreshUserData])

  const handleLogout = async () => {
    await logout()
  }

  const handleTimeCategoryChange = (category: TimeControlCategory) => {
    setTimeCategory(category)
    if (category === 'unlimited') {
      setSelectedPreset(null)
    } else {
      // Select first preset of the category
      setSelectedPreset(TIME_PRESETS[category][0])
    }
  }

  const getUserEloForCategory = (): number => {
    if (!user) return 1200
    // For PvE mode, show PvE ratings
    if (mode === 'pve') {
      switch (timeCategory) {
        case 'bullet': return user.elo_bullet_pve || 1200
        case 'blitz': return user.elo_blitz_pve || 1200
        case 'rapid': return user.elo_rapid_pve || 1200
        default: return user.highest_elo_pve || 1200
      }
    }
    // For PvP mode, show PvP ratings
    switch (timeCategory) {
      case 'bullet': return user.elo_bullet
      case 'blitz': return user.elo_blitz
      case 'rapid': return user.elo_rapid
      default: return user.highest_elo
    }
  }

  const getRatingLabel = (): string => {
    const prefix = mode === 'pve' ? 'PvE ' : 'PvP '
    if (timeCategory !== 'unlimited') {
      return prefix + timeCategory.toUpperCase() + ': '
    }
    return prefix + 'ELO: '
  }

  const handleJoinQueue = useCallback(() => {
    joinQueue(pvpType, timeCategory, selectedPreset?.initial || 0, selectedPreset?.increment || 0)
  }, [joinQueue, pvpType, timeCategory, selectedPreset])

  const isOnlinePvP = mode === 'pvp' && (pvpType === 'online_ranked' || pvpType === 'online_unranked')

  const handleStartGame = async () => {
    // For online PvP, use matchmaking
    if (isOnlinePvP) {
      handleJoinQueue()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await api.createGame({
        mode,
        pvp_type: mode === 'pvp' ? pvpType : undefined,
        difficulty: mode === 'pve' ? difficulty : undefined,
        board_size: boardSize,
        time_control: timeCategory,
        initial_time_seconds: selectedPreset?.initial || 0,
        increment_seconds: selectedPreset?.increment || 0,
      })
      navigate(`/game/${response.id}`)
    } catch (err) {
      setError('Failed to create game. Please try again.')
      console.error('Failed to create game:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Navigation */}
      <nav className={styles.navBar}>
        <Link to="/leaderboard" className={styles.navLink}>
          Leaderboard
        </Link>
        {isAuthenticated && user && (
          <>
            <Link to="/history" className={styles.navLink}>
              Match History
            </Link>
            <Link to={`/profile/${user.id}`} className={styles.navLink}>
              My Profile
            </Link>
          </>
        )}
      </nav>

      {/* User Bar */}
      <div className={styles.userBar}>
        {isAuthenticated && user ? (
          <div className={styles.userInfo}>
            <span className={styles.username}>{user.username}</span>
            <span className={styles.rating}>
              {getRatingLabel()}{getUserEloForCategory()}
            </span>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className={styles.authLinks}>
            <Link to="/login" className={styles.authLink}>
              Sign In
            </Link>
            <Link to="/register" className={styles.authLinkPrimary}>
              Sign Up
            </Link>
          </div>
        )}
      </div>

      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>STRANGER THINGS</h1>
          <p className={styles.subtitle}>AI Battle Arena</p>
        </header>

        <div className={styles.options}>
          {/* Guest Banner */}
          {!isAuthenticated && (
            <div className={styles.guestBanner}>
              Playing as guest - ratings won't be saved.{' '}
              <Link to="/login" className={styles.guestLink}>Sign in</Link> to track your progress.
            </div>
          )}

          {/* Game Mode */}
          <div className={styles.optionGroup}>
            <label className={styles.label}>Game Mode</label>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.optionButton} ${mode === 'pve' ? styles.active : ''}`}
                onClick={() => setMode('pve')}
              >
                vs AI
              </button>
              <button
                className={`${styles.optionButton} ${mode === 'pvp' ? styles.active : ''}`}
                onClick={() => setMode('pvp')}
              >
                vs Player
              </button>
            </div>
          </div>

          {/* PvP Type (only for PvP mode) */}
          {mode === 'pvp' && (
            <div className={styles.optionGroup}>
              <label className={styles.label}>PvP Type</label>
              <div className={styles.pvpTypeGrid}>
                <button
                  className={`${styles.pvpTypeButton} ${styles.pvpTypeLocal} ${pvpType === 'local' ? styles.active : ''}`}
                  onClick={() => setPvpType('local')}
                >
                  <span className={styles.pvpTypeName}>Local</span>
                  <span className={styles.pvpTypeDesc}>Same device</span>
                  <span className={`${styles.pvpTypeBadge} ${styles.badgeUnranked}`}>Unranked</span>
                </button>
                <button
                  className={`${styles.pvpTypeButton} ${styles.pvpTypeRanked} ${pvpType === 'online_ranked' ? styles.active : ''} ${!isAuthenticated ? styles.disabled : ''}`}
                  onClick={() => isAuthenticated && setPvpType('online_ranked')}
                  disabled={!isAuthenticated}
                  title={!isAuthenticated ? 'Login required for ranked games' : undefined}
                >
                  <span className={styles.pvpTypeName}>Online Ranked</span>
                  <span className={styles.pvpTypeDesc}>ELO matchmaking</span>
                  <span className={`${styles.pvpTypeBadge} ${styles.badgeRanked}`}>Ranked</span>
                  {!isAuthenticated && <span className={styles.pvpTypeLock}>Login required</span>}
                </button>
                <button
                  className={`${styles.pvpTypeButton} ${styles.pvpTypeCasual} ${pvpType === 'online_unranked' ? styles.active : ''} ${!isAuthenticated ? styles.disabled : ''}`}
                  onClick={() => isAuthenticated && setPvpType('online_unranked')}
                  disabled={!isAuthenticated}
                  title={!isAuthenticated ? 'Login required for online games' : undefined}
                >
                  <span className={styles.pvpTypeName}>Online Casual</span>
                  <span className={styles.pvpTypeDesc}>Play for fun</span>
                  <span className={`${styles.pvpTypeBadge} ${styles.badgeUnranked}`}>Unranked</span>
                  {!isAuthenticated && <span className={styles.pvpTypeLock}>Login required</span>}
                </button>
              </div>
            </div>
          )}

          {/* Time Control */}
          <div className={styles.optionGroup}>
            <label className={styles.label}>Time Control</label>
            <div className={styles.timeControlTabs}>
              {(['bullet', 'blitz', 'rapid', 'unlimited'] as TimeControlCategory[]).map((cat) => (
                <button
                  key={cat}
                  className={`${styles.timeTab} ${timeCategory === cat ? styles.active : ''}`}
                  onClick={() => handleTimeCategoryChange(cat)}
                >
                  {cat === 'unlimited' ? '∞' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            {timeCategory !== 'unlimited' && (
              <div className={styles.timePresets}>
                {TIME_PRESETS[timeCategory].map((preset) => (
                  <button
                    key={preset.name}
                    className={`${styles.presetButton} ${
                      selectedPreset?.name === preset.name ? styles.active : ''
                    }`}
                    onClick={() => setSelectedPreset(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
            {timeCategory === 'unlimited' && (
              <div className={styles.unlimitedInfo}>
                No time limit - take your time to think
              </div>
            )}
          </div>

          {/* Difficulty (only for PvE) */}
          {mode === 'pve' && (
            <div className={styles.optionGroup}>
              <label className={styles.label}>AI Difficulty</label>
              <div className={styles.difficultyGrid}>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    className={`${styles.difficultyButton} ${difficulty === d.value ? styles.active : ''}`}
                    onClick={() => setDifficulty(d.value)}
                  >
                    <span className={styles.difficultyName}>{d.name}</span>
                    <span className={styles.difficultyRating}>{d.rating}</span>
                    <span className={styles.difficultyDesc}>{d.character}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Board Size */}
          <div className={styles.optionGroup}>
            <label className={styles.label}>Board Size</label>
            <div className={styles.buttonGroup}>
              {([5, 6, 7, 8] as BoardSize[]).map((size) => (
                <button
                  key={size}
                  className={`${styles.optionButton} ${boardSize === size ? styles.active : ''}`}
                  onClick={() => setBoardSize(size)}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {/* Online Matchmaking Queue */}
          {isOnlinePvP ? (
            <MatchmakingQueue
              queueState={queueState}
              matchFound={matchFound}
              onJoinQueue={handleJoinQueue}
              onLeaveQueue={leaveQueue}
              onClearMatch={clearMatchFound}
              isConnected={lobbyConnected}
              disabled={!isAuthenticated}
            />
          ) : (
            <Button
              variant="primary"
              size="large"
              fullWidth
              onClick={handleStartGame}
              disabled={isLoading}
            >
              {isLoading ? 'Creating Game...' : 'Start Game'}
            </Button>
          )}

          {/* Game Summary */}
          <div className={styles.gameSummary}>
            <span className={styles.summaryItem}>
              {mode === 'pve'
                ? `vs ${DIFFICULTIES.find(d => d.value === difficulty)?.character} (${DIFFICULTIES.find(d => d.value === difficulty)?.rating})`
                : `vs Player (${pvpType === 'online_ranked' ? 'Ranked' : pvpType === 'online_unranked' ? 'Casual' : 'Local'})`}
            </span>
            <span className={styles.summaryDot}>•</span>
            <span className={styles.summaryItem}>
              {timeCategory === 'unlimited' ? 'No time limit' : selectedPreset?.name}
            </span>
            <span className={styles.summaryDot}>•</span>
            <span className={styles.summaryItem}>{boardSize}x{boardSize}</span>
          </div>

          {/* Online Players Panel (only show for authenticated users) */}
          {isAuthenticated && (
            <OnlinePlayersPanel
              players={onlinePlayers}
              count={onlineCount}
              isConnected={lobbyConnected}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Home
