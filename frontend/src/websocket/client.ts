import { MessageType, WebSocketMessage } from '../types/websocket'
import { Position } from '../types/game'

type MessageHandler = (data: unknown) => void

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'
type ConnectionHandler = (status: ConnectionStatus) => void

class GameWebSocketClient {
  private ws: WebSocket | null = null
  private gameId: string | null = null
  private handlers: Map<MessageType, MessageHandler[]> = new Map()
  private connectionHandlers: ConnectionHandler[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private intentionalDisconnect = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectionPromise: Promise<void> | null = null
  private _connectionStatus: ConnectionStatus = 'disconnected'

  connect(gameId: string): Promise<void> {
    // If already connected to the same game, return existing connection
    if (this.ws && this.gameId === gameId && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    // If already connecting to the same game, return the existing promise
    if (this.connectionPromise && this.gameId === gameId && this.ws?.readyState === WebSocket.CONNECTING) {
      return this.connectionPromise
    }

    // Clean up any existing connection
    this.cleanupConnection()

    this.gameId = gameId
    this.intentionalDisconnect = false
    this.reconnectAttempts = 0

    this.connectionPromise = new Promise((resolve, reject) => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.VITE_WS_HOST || window.location.host
      const wsUrl = `${wsProtocol}//${host}/ws/game/${gameId}/`

      console.log('Connecting to WebSocket:', wsUrl)
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.setConnectionStatus('connected')
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (this.reconnectAttempts === 0) {
          reject(error)
        }
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        this.connectionPromise = null
        if (!this.intentionalDisconnect) {
          this.setConnectionStatus('reconnecting')
          this.attemptReconnect()
        } else {
          this.setConnectionStatus('disconnected')
        }
      }
    })

    return this.connectionPromise
  }

  private cleanupConnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      // Remove all event handlers to prevent callbacks during cleanup
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
    this.connectionPromise = null
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    this.cleanupConnection()
    this.handlers.clear()
    this.connectionHandlers = []
    this.gameId = null
    this.setConnectionStatus('disconnected')
  }

  send(type: MessageType, data: unknown = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data })
      console.log('Sending:', message)
      this.ws.send(message)
    } else {
      console.error('WebSocket is not connected')
    }
  }

  on(type: MessageType, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(type) || []
    handlers.push(handler)
    this.handlers.set(type, handlers)

    // Return unsubscribe function
    return () => {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('Received:', message.type, message.data)
    const handlers = this.handlers.get(message.type as MessageType) || []
    handlers.forEach((handler) => handler(message.data))
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this._connectionStatus !== status) {
      this._connectionStatus = status
      this.connectionHandlers.forEach((handler) => handler(status))
    }
  }

  private attemptReconnect(): void {
    if (this.intentionalDisconnect) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.gameId) {
      console.error('Max reconnection attempts reached')
      this.setConnectionStatus('disconnected')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts

    console.log(`Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`)
    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalDisconnect && this.gameId) {
        this.connect(this.gameId).catch(() => {
          // Reconnection will be attempted again via onclose
        })
      }
    }, delay)
  }

  // Game-specific methods
  makeMove(from: Position, to: Position, captured?: Position): void {
    this.send('make_move', { from, to, captured })
  }

  requestState(): void {
    this.send('request_state', {})
  }

  forfeit(): void {
    this.send('forfeit', {})
  }

  requestRematch(): void {
    this.send('request_rematch', {})
  }

  acceptRematch(): void {
    this.send('accept_rematch', {})
  }

  declineRematch(): void {
    this.send('decline_rematch', {})
  }

  sendChatMessage(message: string): void {
    this.send('chat_message', { message })
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  getConnectionStatus(): ConnectionStatus {
    return this._connectionStatus
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler)
    // Return unsubscribe function
    return () => {
      const idx = this.connectionHandlers.indexOf(handler)
      if (idx > -1) this.connectionHandlers.splice(idx, 1)
    }
  }
}

export const wsClient = new GameWebSocketClient()
export default GameWebSocketClient
