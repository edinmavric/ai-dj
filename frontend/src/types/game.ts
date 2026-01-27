export interface Position {
  row: number
  col: number
}

export interface Move {
  from: Position
  to: Position
  captured?: Position
}

export interface Board {
  size: number
  grid: number[][]
}

export type GamePhase = 'setup' | 'playing' | 'finished'
export type GameMode = 'pvp' | 'pve'
export type DifficultyLevel = 1 | 2 | 3 | 4
export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid' | 'unlimited'

export interface GameState {
  board: Board
  current_player: 1 | 2
  phase: GamePhase
  turn_number: number
  move_history: Move[]
  winner: 1 | 2 | null
}

export interface GameSession {
  id: string
  mode: GameMode
  status: 'waiting' | 'in_progress' | 'completed' | 'abandoned'
  difficulty?: DifficultyLevel
  board_size: number
  game_state: GameState
  player_one_id?: string
  player_one_username?: string
  player_two_id?: string
  player_two_username?: string
  ai_won?: boolean
  created_at: string
  // Time control fields
  time_control: TimeControlCategory
  time_control_display?: string
  initial_time_seconds: number
  increment_seconds: number
  player_one_time_ms?: number
  player_two_time_ms?: number
  clock_running?: boolean
}

export interface TimeControlPreset {
  name: string
  initial: number  // seconds
  increment: number  // seconds
}

export interface TimeControlPresets {
  bullet: TimeControlPreset[]
  blitz: TimeControlPreset[]
  rapid: TimeControlPreset[]
}

export type PvPType = 'online' | 'local'

export interface CreateGameOptions {
  mode: GameMode
  pvp_type?: PvPType  // For PvP: 'online' (ranked) or 'local' (unranked)
  difficulty?: DifficultyLevel
  board_size: number
  time_control?: TimeControlCategory
  initial_time_seconds?: number
  increment_seconds?: number
}

export interface DifficultyInfo {
  level: number
  name: string
  character: string
  algorithm: string
  description: string
}

export const PIECE_TYPES = {
  EMPTY: 0,
  PLAYER_ONE: 1,
  PLAYER_TWO: 2
} as const

export const DIFFICULTY_NAMES: Record<DifficultyLevel, string> = {
  1: 'Demogorgon',
  2: 'Alpha AI',
  3: 'Shadow Monster',
  4: 'Mind Flayer'
}
