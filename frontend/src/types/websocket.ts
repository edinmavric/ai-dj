import { GameState, Move } from './game'

export type MessageType =
  // Client -> Server
  | 'make_move'
  | 'request_state'
  | 'forfeit'
  | 'request_rematch'
  | 'accept_rematch'
  | 'decline_rematch'
  | 'chat_message'
  // Server -> Client
  | 'game_state'
  | 'game_update'
  | 'ai_move'
  | 'move_rejected'
  | 'game_over'
  | 'clock_update'
  | 'player_disconnected'
  | 'rematch_requested'
  | 'rematch_accepted'
  | 'rematch_declined'
  | 'rematch_created'
  | 'error'

export interface WebSocketMessage {
  type: MessageType
  data: unknown
}

export interface GameStateMessage {
  game_state: GameState
  status: string
  mode: string
  pvp_type: 'local' | 'online_ranked' | 'online_unranked' | null
  difficulty: number | null
  player_one_id: string | null
  player_two_id: string | null
  player_one_username?: string
  player_two_username?: string
}

export interface GameUpdateMessage {
  board: GameState['board']
  current_player: 1 | 2
  phase: string
  turn_number: number
  winner: 1 | 2 | null
}

export interface AIMoveMessage {
  move: Move
  game_state: GameState
  stats: {
    algorithm: string
    nodes_evaluated: number
    depth?: number
    iterations?: number
  }
}

export interface RatingChangeData {
  user_id: string
  old_rating: number
  new_rating: number
  change: number
}

export interface GameOverMessage {
  winner_id?: string
  winner?: 1 | 2
  ai_won: boolean
  reason: string
  rating_changes?: {
    player_one?: RatingChangeData
    player_two?: RatingChangeData
  }
}

export interface ChatMessageData {
  player_id: string
  message: string
  timestamp?: string
}

export interface ErrorMessage {
  message: string
  code?: string
}

export interface ClockUpdateMessage {
  player_one_time_ms: number
  player_two_time_ms: number
  active_player: 1 | 2
}

export interface RematchRequestedMessage {
  player_id: string
}

export interface RematchAcceptedMessage {
  new_game_id: string
  player_id: string
}

export interface RematchDeclinedMessage {
  player_id: string
}

export interface RematchCreatedMessage {
  new_game_id: string
  player_id: string
}
