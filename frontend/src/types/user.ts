export interface User {
  id: string
  username: string
  email: string
  avatar: string | null
  bio: string
  country: string

  // PvP ELO ratings per time control
  elo_bullet: number
  elo_blitz: number
  elo_rapid: number

  // PvE ELO ratings per time control
  elo_bullet_pve: number
  elo_blitz_pve: number
  elo_rapid_pve: number

  // Provisional flags (PvP)
  bullet_provisional: boolean
  blitz_provisional: boolean
  rapid_provisional: boolean

  // PvP game counts per time control
  bullet_games_count: number
  blitz_games_count: number
  rapid_games_count: number

  // PvE game counts per time control
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

  // Computed fields
  win_rate: number
  pve_win_rate: number
  highest_elo: number
  highest_elo_pve: number

  created_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  password_confirm: string
  country?: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

// LeaderboardEntry is defined in api/user.ts to match backend response

export interface RatingHistoryEntry {
  id: string
  rating_type: 'bullet' | 'blitz' | 'rapid'
  game_mode: 'pvp' | 'pve'
  rating: number
  change: number
  game: string | null
  timestamp: string
}

export interface UserStats {
  user: User
  rating_history: {
    bullet: RatingHistoryEntry[]
    blitz: RatingHistoryEntry[]
    rapid: RatingHistoryEntry[]
  }
}

export type TimeControl = 'bullet' | 'blitz' | 'rapid'
