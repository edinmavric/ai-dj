import { apiClient } from './client'
import {
  GameSession,
  DifficultyLevel,
  GameMode,
  TimeControlCategory,
  TimeControlPresets,
  CreateGameOptions
} from '../types/game'

interface CreateGameResponse {
  id: string
  mode: GameMode
  status: string
  difficulty: DifficultyLevel | null
  board_size: number
  time_control: TimeControlCategory
  initial_time_seconds: number
  increment_seconds: number
  player_one_time_ms: number | null
  player_two_time_ms: number | null
}

interface GameListResponse {
  results: GameSession[]
  count: number
}

interface DifficultyInfo {
  level: DifficultyLevel
  name: string
  description: string
  algorithm: string
  character: string
}

interface LobbyGame {
  id: string
  host_username: string | null
  board_size: number
  time_control: TimeControlCategory
  time_control_display: string
  initial_time_seconds: number
  increment_seconds: number
  created_at: string
}

export const gameApi = {
  createGame: async (data: CreateGameOptions): Promise<CreateGameResponse> => {
    return apiClient.post<CreateGameResponse>('/games/', data)
  },

  getGame: async (gameId: string): Promise<GameSession> => {
    return apiClient.get<GameSession>(`/games/${gameId}/`)
  },

  listGames: async (): Promise<GameListResponse> => {
    return apiClient.get<GameListResponse>('/games/')
  },

  joinGame: async (gameId: string): Promise<GameSession> => {
    return apiClient.post<GameSession>(`/games/${gameId}/join/`)
  },

  getDifficultyLevels: async (): Promise<DifficultyInfo[]> => {
    return apiClient.get<DifficultyInfo[]>('/difficulty-levels/')
  },

  getTimeControlPresets: async (): Promise<TimeControlPresets> => {
    return apiClient.get<TimeControlPresets>('/time-controls/')
  },

  getLobbyGames: async (): Promise<LobbyGame[]> => {
    return apiClient.get<LobbyGame[]>('/lobby/')
  },

  forfeitGame: async (gameId: string): Promise<{ success: boolean }> => {
    return apiClient.post<{ success: boolean }>(`/games/${gameId}/forfeit/`)
  },
}

export default gameApi
