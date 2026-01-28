/**
 * Hook for managing lobby connection, online players, and matchmaking.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { lobbyClient, OnlinePlayer, MatchFoundData, QueueJoinedData, OnlinePlayersData } from '../websocket/lobbyClient'

interface QueueState {
  inQueue: boolean
  queueType: string | null
  position: number
  playersWaiting: number
}

interface UseLobbyReturn {
  isConnected: boolean
  onlinePlayers: OnlinePlayer[]
  onlineCount: number
  queueState: QueueState
  matchFound: MatchFoundData | null
  joinQueue: (pvpType: string, timeControl: string, initialTimeSeconds: number, incrementSeconds: number) => void
  leaveQueue: () => void
  clearMatchFound: () => void
}

export function useLobby(autoConnect = true): UseLobbyReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [queueState, setQueueState] = useState<QueueState>({
    inQueue: false,
    queueType: null,
    position: 0,
    playersWaiting: 0,
  })
  const [matchFound, setMatchFound] = useState<MatchFoundData | null>(null)

  const unsubscribesRef = useRef<(() => void)[]>([])

  useEffect(() => {
    if (!autoConnect) return

    const connectAndSubscribe = async () => {
      // Check for auth token before attempting connection
      // Tokens are stored as JSON under 'auth_tokens' key
      const storedTokens = localStorage.getItem('auth_tokens')
      let hasToken = false
      if (storedTokens) {
        try {
          const parsed = JSON.parse(storedTokens)
          hasToken = !!parsed.access
        } catch {
          // Invalid JSON
        }
      }
      if (!hasToken) {
        console.log('Lobby: Not connecting - no auth token')
        setIsConnected(false)
        return
      }

      // Set up event handlers first
      unsubscribesRef.current = [
        lobbyClient.onConnectionChange((connected) => {
          setIsConnected(connected)
        }),
        lobbyClient.on('online_players', (data) => {
          const playersData = data as OnlinePlayersData
          setOnlinePlayers(playersData.players)
          setOnlineCount(playersData.count)
        }),
        lobbyClient.on('queue_joined', (data) => {
          const queueData = data as QueueJoinedData
          setQueueState({
            inQueue: true,
            queueType: queueData.queue_type,
            position: queueData.position,
            playersWaiting: queueData.players_waiting,
          })
        }),
        lobbyClient.on('queue_left', () => {
          setQueueState({
            inQueue: false,
            queueType: null,
            position: 0,
            playersWaiting: 0,
          })
        }),
        lobbyClient.on('match_found', (data) => {
          const matchData = data as MatchFoundData
          setMatchFound(matchData)
          setQueueState({
            inQueue: false,
            queueType: null,
            position: 0,
            playersWaiting: 0,
          })
        }),
      ]

      // Then connect (automatic retry on failure)
      try {
        await lobbyClient.connect()
      } catch (error) {
        // Connection failed but will auto-retry, just log it
        console.log('Lobby: Initial connection failed, retrying...')
        setIsConnected(false)
      }
    }

    connectAndSubscribe()

    return () => {
      unsubscribesRef.current.forEach((unsub) => unsub())
      unsubscribesRef.current = []
      lobbyClient.disconnect()
    }
  }, [autoConnect])

  const joinQueue = useCallback((pvpType: string, timeControl: string, initialTimeSeconds: number, incrementSeconds: number) => {
    lobbyClient.joinQueue(pvpType, timeControl, initialTimeSeconds, incrementSeconds)
  }, [])

  const leaveQueue = useCallback(() => {
    lobbyClient.leaveQueue()
  }, [])

  const clearMatchFound = useCallback(() => {
    setMatchFound(null)
  }, [])

  return {
    isConnected,
    onlinePlayers,
    onlineCount,
    queueState,
    matchFound,
    joinQueue,
    leaveQueue,
    clearMatchFound,
  }
}
