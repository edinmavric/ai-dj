import { apiClient } from './client'

export interface LeaderboardEntry {
  id: string
  username: string
  rank: number
  elo: number
  games_played: number
  games_won: number
  games_lost: number
  games_drawn: number
  game_mode?: 'pvp' | 'pve'
}

export interface RatingHistoryEntry {
  id: string
  rating_type: 'bullet' | 'blitz' | 'rapid'
  game_mode: 'pvp' | 'pve'
  rating: number
  change: number
  timestamp: string
  game_id?: string
}

export interface UserProfile {
  id: string
  username: string
  email?: string
  // PvP ELO ratings
  elo_bullet: number
  elo_blitz: number
  elo_rapid: number
  // PvE ELO ratings
  elo_bullet_pve: number
  elo_blitz_pve: number
  elo_rapid_pve: number
  // PvP game counts
  bullet_games_count: number
  blitz_games_count: number
  rapid_games_count: number
  // PvE game counts
  bullet_pve_games_count: number
  blitz_pve_games_count: number
  rapid_pve_games_count: number
  // PvP statistics
  games_played: number
  games_won: number
  games_lost: number
  games_drawn: number
  // PvE statistics
  pve_games_played: number
  pve_games_won: number
  pve_games_lost: number
  // Computed
  win_rate: number
  pve_win_rate: number
  highest_elo: number
  highest_elo_pve: number
  created_at: string
}

export interface UserStats {
  user: UserProfile
  rating_history: {
    pvp: {
      bullet: RatingHistoryEntry[]
      blitz: RatingHistoryEntry[]
      rapid: RatingHistoryEntry[]
    }
    pve: {
      bullet: RatingHistoryEntry[]
      blitz: RatingHistoryEntry[]
      rapid: RatingHistoryEntry[]
    }
  }
}

export interface GameRecord {
  id: string
  player_one: { id: string; username: string } | null
  player_two: { id: string; username: string } | null
  winner: { id: string; username: string } | null
  mode: 'pve' | 'pvp'
  pvp_type: 'local' | 'online_ranked' | 'online_unranked' | null
  time_control: string
  ai_won: boolean
  completed_at: string
}

export const userApi = {
  getLeaderboard: (
    category: 'bullet' | 'blitz' | 'rapid',
    gameMode: 'pvp' | 'pve' = 'pvp'
  ): Promise<LeaderboardEntry[]> => {
    return apiClient.get(`/leaderboard/${category}/`, { mode: gameMode }, { skipAuth: true })
  },

  searchPlayers: (query: string): Promise<UserProfile[]> => {
    return apiClient.get('/leaderboard/search/', { q: query }, { skipAuth: true })
  },

  getPublicProfile: (userId: string): Promise<UserProfile> => {
    return apiClient.get(`/users/${userId}/`, undefined, { skipAuth: true })
  },

  getUserStats: (userId: string): Promise<UserStats> => {
    return apiClient.get(`/users/${userId}/stats/`, undefined, { skipAuth: true })
  },

  getUserGames: (userId: string): Promise<GameRecord[]> => {
    return apiClient.get(`/users/${userId}/games/`, undefined, { skipAuth: true })
  },
}

export default userApi
