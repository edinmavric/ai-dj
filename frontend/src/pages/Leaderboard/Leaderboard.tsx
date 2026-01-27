import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { userApi, LeaderboardEntry } from '../../api/user'
import styles from './Leaderboard.module.css'

type TimeCategory = 'bullet' | 'blitz' | 'rapid'
type GameMode = 'pvp' | 'pve'

const TIME_TABS: { key: TimeCategory; label: string; icon: string }[] = [
  { key: 'bullet', label: 'Bullet', icon: '.' },
  { key: 'blitz', label: 'Blitz', icon: '..' },
  { key: 'rapid', label: 'Rapid', icon: '...' },
]

export const Leaderboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TimeCategory) || 'blitz'
  const initialMode = (searchParams.get('mode') as GameMode) || 'pvp'

  const [activeTab, setActiveTab] = useState<TimeCategory>(initialTab)
  const [gameMode, setGameMode] = useState<GameMode>(initialMode)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchLeaderboard = useCallback(async (category: TimeCategory, mode: GameMode) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await userApi.getLeaderboard(category, mode)
      setLeaderboard(data)
    } catch (err) {
      setError('Failed to load leaderboard')
      console.error('Failed to fetch leaderboard:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard(activeTab, gameMode)
  }, [activeTab, gameMode, fetchLeaderboard])

  const handleTabChange = (tab: TimeCategory) => {
    setActiveTab(tab)
    setSearchParams({ tab, mode: gameMode })
  }

  const handleModeChange = (mode: GameMode) => {
    setGameMode(mode)
    setSearchParams({ tab: activeTab, mode })
  }

  const filteredLeaderboard = searchQuery
    ? leaderboard.filter((entry) =>
        entry.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leaderboard

  const getWinRate = (entry: LeaderboardEntry): string => {
    if (entry.games_played === 0) return '0%'
    return `${Math.round((entry.games_won / entry.games_played) * 100)}%`
  }

  const getRankClass = (rank: number): string => {
    if (rank === 1) return styles.gold
    if (rank === 2) return styles.silver
    if (rank === 3) return styles.bronze
    return ''
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <Link to="/" className={styles.backLink}>
            &larr; Back to Home
          </Link>
          <h1 className={styles.title}>LEADERBOARD</h1>
          <p className={styles.subtitle}>Top Players</p>
        </header>

        {/* Game Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeButton} ${gameMode === 'pvp' ? styles.active : ''}`}
            onClick={() => handleModeChange('pvp')}
          >
            PvP Rankings
          </button>
          <button
            className={`${styles.modeButton} ${gameMode === 'pve' ? styles.active : ''}`}
            onClick={() => handleModeChange('pve')}
          >
            PvE Rankings
          </button>
        </div>

        <div className={styles.tabs}>
          {TIME_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading leaderboard...</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.rankCol}>Rank</th>
                  <th className={styles.playerCol}>Player</th>
                  <th className={styles.ratingCol}>Rating</th>
                  <th className={styles.gamesCol}>Games</th>
                  <th className={styles.winRateCol}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noResults}>
                      {searchQuery ? 'No players found' : 'No players yet'}
                    </td>
                  </tr>
                ) : (
                  filteredLeaderboard.map((entry) => (
                    <tr key={entry.id} className={styles.row}>
                      <td className={`${styles.rank} ${getRankClass(entry.rank)}`}>
                        {entry.rank <= 3 ? (
                          <span className={styles.medal}>
                            {entry.rank === 1 ? '1' : entry.rank === 2 ? '2' : '3'}
                          </span>
                        ) : (
                          entry.rank
                        )}
                      </td>
                      <td className={styles.player}>
                        <Link to={`/profile/${entry.id}`} className={styles.playerLink}>
                          {entry.username}
                        </Link>
                      </td>
                      <td className={styles.rating}>{entry.elo}</td>
                      <td className={styles.games}>{entry.games_played}</td>
                      <td className={styles.winRate}>{getWinRate(entry)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
