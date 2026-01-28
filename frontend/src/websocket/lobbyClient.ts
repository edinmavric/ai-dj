/**
 * WebSocket client for lobby and matchmaking.
 */

export interface OnlinePlayer {
  user_id: string
  username: string
  rating: number
}

export interface MatchFoundData {
  game_id: string
  opponent: string
}

export interface QueueJoinedData {
  queue_type: string
  position: number
  players_waiting: number
}

export interface OnlinePlayersData {
  players: OnlinePlayer[]
  count: number
}

type LobbyMessageType = 'online_players' | 'queue_joined' | 'queue_left' | 'match_found' | 'error'
type MessageHandler = (data: unknown) => void
type ConnectionHandler = (connected: boolean) => void

class LobbyWebSocketClient {
  private ws: WebSocket | null = null
  private handlers: Map<LobbyMessageType, MessageHandler[]> = new Map()
  private connectionHandlers: ConnectionHandler[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private intentionalDisconnect = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    this.intentionalDisconnect = false
    this.reconnectAttempts = 0

    return new Promise((resolve, reject) => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.VITE_WS_HOST || window.location.host

      // Include JWT token in query string for authentication
      // Tokens are stored as JSON under 'auth_tokens' key
      const storedTokens = localStorage.getItem('auth_tokens')
      let token: string | null = null
      if (storedTokens) {
        try {
          const parsed = JSON.parse(storedTokens)
          token = parsed.access || null
        } catch {
          console.warn('Failed to parse auth tokens')
        }
      }
      console.log('Lobby token exists:', !!token)

      if (!token) {
        console.warn('No access token found for lobby connection')
        reject(new Error('No auth token'))
        return
      }

      const wsUrl = `${wsProtocol}//${host}/ws/lobby/?token=${token}`

      console.log('Connecting to Lobby WebSocket:', wsUrl.replace(/token=.*/, 'token=***'))
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('Lobby WebSocket connected')
        this.reconnectAttempts = 0
        this.notifyConnectionChange(true)
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (e) {
          console.error('Failed to parse Lobby WebSocket message:', e)
        }
      }

      this.ws.onerror = (error) => {
        console.error('Lobby WebSocket error:', error)
        if (this.reconnectAttempts === 0) {
          reject(error)
        }
      }

      this.ws.onclose = () => {
        console.log('Lobby WebSocket closed')
        this.notifyConnectionChange(false)
        if (!this.intentionalDisconnect) {
          this.attemptReconnect()
        }
      }
    })
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.handlers.clear()
    this.connectionHandlers = []
  }

  private attemptReconnect(): void {
    if (this.intentionalDisconnect) return

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Lobby: Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts

    console.log(`Lobby reconnection attempt ${this.reconnectAttempts} in ${delay}ms`)
    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalDisconnect) {
        this.connect().catch(() => {})
      }
    }, delay)
  }

  private send(type: string, data: unknown = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  on(type: LobbyMessageType, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(type) || []
    handlers.push(handler)
    this.handlers.set(type, handlers)

    return () => {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler)
    return () => {
      const idx = this.connectionHandlers.indexOf(handler)
      if (idx > -1) this.connectionHandlers.splice(idx, 1)
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => handler(connected))
  }

  private handleMessage(message: { type: LobbyMessageType; data: unknown }): void {
    console.log('Lobby received:', message.type, message.data)
    const handlers = this.handlers.get(message.type) || []
    handlers.forEach((handler) => handler(message.data))
  }

  // Lobby-specific methods
  joinQueue(pvpType: string, timeControl: string, initialTimeSeconds: number, incrementSeconds: number): void {
    this.send('join_queue', {
      pvp_type: pvpType,
      time_control: timeControl,
      initial_time_seconds: initialTimeSeconds,
      increment_seconds: incrementSeconds,
    })
  }

  leaveQueue(): void {
    this.send('leave_queue', {})
  }

  getOnlinePlayers(): void {
    this.send('get_online_players', {})
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

export const lobbyClient = new LobbyWebSocketClient()
export default LobbyWebSocketClient
