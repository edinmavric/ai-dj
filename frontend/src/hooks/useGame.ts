import { useState, useEffect, useCallback, useRef } from 'react'
import { wsClient, ConnectionStatus } from '../websocket/client'
import { useSound } from './useSound'
import {
  GameState,
  Position,
  Move,
  Board,
  TimeControlCategory,
} from '../types/game'
import {
  GameStateMessage,
  AIMoveMessage,
  GameOverMessage,
  ErrorMessage,
  RematchRequestedMessage,
  RematchAcceptedMessage,
  RematchDeclinedMessage,
  RematchCreatedMessage,
  ChatMessageData,
} from '../types/websocket'

interface UseGameOptions {
  gameId: string
  playerId?: string
}

interface TimeControlState {
  category: TimeControlCategory
  initialTimeSeconds: number
  incrementSeconds: number
  playerOneTimeMs: number
  playerTwoTimeMs: number
  clockRunning: boolean
}

interface RematchState {
  requested: boolean
  requestedBy: string | null
  declined: boolean
  newGameId: string | null
}

interface UseGameReturn {
  gameState: GameState | null
  selectedPosition: Position | null
  validMoves: Move[]
  isPlayerTurn: boolean
  isLoading: boolean
  error: string | null
  gameOver: GameOverMessage | null
  aiThinking: boolean
  gameMode: 'pve' | 'pvp' | null
  pvpType: 'local' | 'online_ranked' | 'online_unranked' | null
  difficulty: number | null
  timeControl: TimeControlState | null
  playerOneUsername: string
  playerTwoUsername: string
  rematch: RematchState
  connectionStatus: ConnectionStatus
  chatMessages: ChatMessageData[]
  selectPosition: (position: Position) => void
  makeMove: (to: Position) => void
  forfeit: () => void
  requestRematch: () => void
  acceptRematch: () => void
  declineRematch: () => void
  clearError: () => void
  sendChatMessage: (message: string) => void
}

export function useGame({ gameId, playerId: _playerId }: UseGameOptions): UseGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [validMoves, setValidMoves] = useState<Move[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState<GameOverMessage | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [gameMode, setGameMode] = useState<'pve' | 'pvp' | null>(null)
  const [pvpType, setPvpType] = useState<'local' | 'online_ranked' | 'online_unranked' | null>(null)
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [timeControl, setTimeControl] = useState<TimeControlState | null>(null)
  const [playerOneUsername, setPlayerOneUsername] = useState<string>('Player 1')
  const [playerTwoUsername, setPlayerTwoUsername] = useState<string>('Player 2')
  const [rematch, setRematch] = useState<RematchState>({
    requested: false,
    requestedBy: null,
    declined: false,
    newGameId: null,
  })
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([])

  const { playSound } = useSound()
  const unsubscribesRef = useRef<(() => void)[]>([])
  const previousStateRef = useRef<GameState | null>(null)
  const aiThinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiThinkingStartRef = useRef<number | null>(null)

  // Debounced AI thinking state setter
  // Shows "thinking" after 200ms delay, hides immediately
  const setAiThinkingDebounced = useCallback((thinking: boolean) => {
    if (aiThinkingTimerRef.current) {
      clearTimeout(aiThinkingTimerRef.current)
      aiThinkingTimerRef.current = null
    }

    if (thinking) {
      // Delay showing "thinking" to prevent flicker on fast moves
      aiThinkingTimerRef.current = setTimeout(() => {
        aiThinkingStartRef.current = Date.now()
        setAiThinking(true)
      }, 200)
    } else {
      // If AI thinking is already shown, ensure minimum display time of 300ms
      if (aiThinkingStartRef.current) {
        const elapsed = Date.now() - aiThinkingStartRef.current
        const minDisplayTime = 300
        if (elapsed < minDisplayTime) {
          aiThinkingTimerRef.current = setTimeout(() => {
            setAiThinking(false)
            aiThinkingStartRef.current = null
          }, minDisplayTime - elapsed)
        } else {
          setAiThinking(false)
          aiThinkingStartRef.current = null
        }
      } else {
        setAiThinking(false)
      }
    }
  }, [])

  // Apply move locally for optimistic update
  const applyMoveLocally = useCallback((move: Move): GameState | null => {
    if (!gameState) return null

    // Create new grid
    const newGrid = gameState.board.grid.map(row => [...row])

    // Move the piece
    const piece = newGrid[move.from.row][move.from.col]
    newGrid[move.from.row][move.from.col] = 0
    newGrid[move.to.row][move.to.col] = piece

    // Handle capture
    if (move.captured) {
      newGrid[move.captured.row][move.captured.col] = 0
    }

    // Create new state
    return {
      ...gameState,
      board: {
        ...gameState.board,
        grid: newGrid,
      },
      current_player: gameState.current_player === 1 ? 2 : 1,
      turn_number: gameState.turn_number + 1,
    } as GameState
  }, [gameState])

  // Determine if it's the player's turn
  // For local PvP, it's always "the player's turn" since both players are on the same device
  const isLocalPvP = gameMode === 'pvp' && pvpType === 'local'
  const isPlayerTurn =
    gameState !== null &&
    gameState.phase === 'playing' &&
    (isLocalPvP || gameState.current_player === 1) // Player is always player 1, or both for local PvP

  // Connect to WebSocket on mount
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribeConnection = wsClient.onConnectionChange((status) => {
      setConnectionStatus(status)
    })

    const connect = async () => {
      try {
        await wsClient.connect(gameId)

        // Subscribe to messages
        unsubscribesRef.current = [
          wsClient.on('game_state', handleGameState),
          wsClient.on('game_update', handleGameUpdate),
          wsClient.on('ai_move', handleAIMove),
          wsClient.on('move_rejected', handleMoveRejected),
          wsClient.on('game_over', handleGameOver),
          wsClient.on('clock_update', handleClockUpdate),
          wsClient.on('error', handleError),
          wsClient.on('rematch_requested', handleRematchRequested),
          wsClient.on('rematch_accepted', handleRematchAccepted),
          wsClient.on('rematch_declined', handleRematchDeclined),
          wsClient.on('rematch_created', handleRematchCreated),
          wsClient.on('chat_message', handleChatMessage),
        ]

        // Request initial state
        wsClient.requestState()
      } catch (err) {
        setError('Failed to connect to game server')
        setIsLoading(false)
      }
    }

    connect()

    return () => {
      unsubscribeConnection()
      unsubscribesRef.current.forEach((unsub) => unsub())
      wsClient.disconnect()
      // Clean up AI thinking timer
      if (aiThinkingTimerRef.current) {
        clearTimeout(aiThinkingTimerRef.current)
      }
    }
  }, [gameId])

  // Message handlers
  const handleGameState = useCallback((data: unknown) => {
    const msg = data as GameStateMessage & {
      time_control?: TimeControlCategory
      initial_time_seconds?: number
      increment_seconds?: number
      player_one_time_ms?: number
      player_two_time_ms?: number
      clock_running?: boolean
      player_one_username?: string
      player_two_username?: string
    }
    if (!msg?.game_state) {
      console.error('Invalid game_state message:', data)
      return
    }
    setGameState(msg.game_state)
    setSelectedPosition(null)
    setValidMoves([])
    setIsLoading(false)

    // Track game mode, pvp type, and difficulty
    const mode = msg.mode as 'pve' | 'pvp'
    setGameMode(mode)
    setPvpType(msg.pvp_type || null)
    setDifficulty(msg.difficulty)

    // Track time control
    if (msg.time_control && msg.time_control !== 'unlimited') {
      setTimeControl({
        category: msg.time_control,
        initialTimeSeconds: msg.initial_time_seconds || 0,
        incrementSeconds: msg.increment_seconds || 0,
        playerOneTimeMs: msg.player_one_time_ms || 0,
        playerTwoTimeMs: msg.player_two_time_ms || 0,
        clockRunning: msg.clock_running || false,
      })
    } else {
      setTimeControl(null)
    }

    // Track player names
    if (msg.player_one_username) {
      setPlayerOneUsername(msg.player_one_username)
    }
    if (msg.player_two_username) {
      setPlayerTwoUsername(mode === 'pve' ? 'AI' : (msg.player_two_username || 'Player 2'))
    } else if (mode === 'pve') {
      setPlayerTwoUsername('AI')
    }

    // Only show AI thinking in PvE mode
    const isPvE = mode === 'pve'
    setAiThinkingDebounced(isPvE && msg.game_state.current_player === 2 && msg.game_state.phase === 'playing')
  }, [setAiThinkingDebounced])

  const handleGameUpdate = useCallback(
    (data: unknown) => {
      const msg = data as {
        game_state: GameState
        ai_turn?: boolean
        player_one_time_ms?: number
        player_two_time_ms?: number
        clock_running?: boolean
        rating_changes?: {
          player_one?: { user_id: string; old_rating: number; new_rating: number; change: number }
          player_two?: { user_id: string; old_rating: number; new_rating: number; change: number }
        }
      }
      if (!msg?.game_state) {
        console.error('Invalid game_update message:', data)
        return
      }

      // Clear previous state since move was confirmed
      previousStateRef.current = null

      // Update with server state (reconcile with optimistic update)
      setGameState(msg.game_state)
      setSelectedPosition(null)
      setValidMoves([])

      // Detect game over from game_state (backend may not send explicit game_over event for player wins)
      if (msg.game_state.phase === 'finished' && msg.game_state.winner) {
        const playerWon = msg.game_state.winner === 1
        setGameOver({
          winner_id: null,  // Not available in this message
          ai_won: !playerWon,
          reason: 'capture',  // Default reason
          rating_changes: msg.rating_changes,
        })
        setAiThinking(false)
        playSound(playerWon ? 'win' : 'lose')
        return  // Don't continue processing
      }

      // Update time control if present
      if (msg.player_one_time_ms !== undefined || msg.player_two_time_ms !== undefined) {
        setTimeControl((prev) => {
          if (!prev) return null
          return {
            ...prev,
            playerOneTimeMs: msg.player_one_time_ms ?? prev.playerOneTimeMs,
            playerTwoTimeMs: msg.player_two_time_ms ?? prev.playerTwoTimeMs,
            clockRunning: msg.clock_running ?? prev.clockRunning,
          }
        })
      }

      // Only set AI thinking if backend says it's AI turn (backend checks game mode)
      if (msg.ai_turn) {
        setAiThinkingDebounced(true)
      } else {
        setAiThinkingDebounced(false)
      }
    },
    [setAiThinkingDebounced, playSound]
  )

  const handleClockUpdate = useCallback((data: unknown) => {
    const msg = data as {
      player_one_time_ms?: number
      player_two_time_ms?: number
      active_player?: number
    }

    setTimeControl((prev) => {
      if (!prev) return null
      return {
        ...prev,
        playerOneTimeMs: msg.player_one_time_ms ?? prev.playerOneTimeMs,
        playerTwoTimeMs: msg.player_two_time_ms ?? prev.playerTwoTimeMs,
      }
    })
  }, [])

  const handleAIMove = useCallback(
    (data: unknown) => {
      const msg = data as AIMoveMessage & {
        player_one_time_ms?: number
        player_two_time_ms?: number
        clock_running?: boolean
      }
      if (!msg?.game_state) {
        console.error('Invalid ai_move message:', data)
        return
      }
      setGameState(msg.game_state)
      setAiThinkingDebounced(false)

      // Update time control if present
      if (msg.player_one_time_ms !== undefined || msg.player_two_time_ms !== undefined) {
        setTimeControl((prev) => {
          if (!prev) return null
          return {
            ...prev,
            playerOneTimeMs: msg.player_one_time_ms ?? prev.playerOneTimeMs,
            playerTwoTimeMs: msg.player_two_time_ms ?? prev.playerTwoTimeMs,
            clockRunning: msg.clock_running ?? prev.clockRunning,
          }
        })
      }

      // Play appropriate sound
      if (msg.move?.captured) {
        playSound('capture')
      } else {
        playSound('move')
      }
    },
    [playSound, setAiThinkingDebounced]
  )

  const handleMoveRejected = useCallback(
    (data: unknown) => {
      const msg = data as ErrorMessage
      setError(msg?.message || 'Move rejected')
      playSound('error')

      // Revert optimistic update
      if (previousStateRef.current) {
        setGameState(previousStateRef.current)
        previousStateRef.current = null
        setAiThinkingDebounced(false)
      }

      setTimeout(() => setError(null), 3000)
    },
    [playSound, setAiThinkingDebounced]
  )

  const handleGameOver = useCallback(
    (data: unknown) => {
      const msg = data as GameOverMessage
      if (!msg) {
        console.error('Invalid game_over message:', data)
        return
      }
      setGameOver(msg)
      // For game over, immediately clear AI thinking (no debounce needed)
      setAiThinking(false)

      if (msg.ai_won) {
        playSound('lose')
      } else {
        playSound('win')
      }
    },
    [playSound]
  )

  const handleError = useCallback((data: unknown) => {
    const msg = data as ErrorMessage
    setError(msg?.message || 'An error occurred')
  }, [])

  const handleRematchRequested = useCallback((data: unknown) => {
    const msg = data as RematchRequestedMessage
    setRematch({
      requested: true,
      requestedBy: msg?.player_id || null,
      declined: false,
      newGameId: null,
    })
  }, [])

  const handleRematchAccepted = useCallback((data: unknown) => {
    const msg = data as RematchAcceptedMessage
    setRematch((prev) => ({
      ...prev,
      newGameId: msg?.new_game_id || null,
    }))
  }, [])

  const handleRematchDeclined = useCallback((data: unknown) => {
    const _msg = data as RematchDeclinedMessage
    setRematch((prev) => ({
      ...prev,
      declined: true,
      requested: false,
    }))
  }, [])

  const handleRematchCreated = useCallback((data: unknown) => {
    const msg = data as RematchCreatedMessage
    setRematch((prev) => ({
      ...prev,
      newGameId: msg?.new_game_id || null,
    }))
  }, [])

  const handleChatMessage = useCallback((data: unknown) => {
    const msg = data as ChatMessageData
    if (!msg?.message) return
    setChatMessages((prev) => [
      ...prev,
      {
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString(),
      },
    ])
  }, [])

  // Calculate valid moves for a piece
  const calculateValidMoves = useCallback(
    (board: Board, position: Position, player: number): Move[] => {
      const moves: Move[] = []
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]

      for (const [dr, dc] of directions) {
        const newRow = position.row + dr
        const newCol = position.col + dc

        // Standard move
        if (
          newRow >= 0 &&
          newRow < board.size &&
          newCol >= 0 &&
          newCol < board.size &&
          board.grid[newRow][newCol] === 0
        ) {
          moves.push({
            from: position,
            to: { row: newRow, col: newCol },
          })
        }

        // Capture move
        const jumpRow = position.row + 2 * dr
        const jumpCol = position.col + 2 * dc
        const midRow = position.row + dr
        const midCol = position.col + dc

        if (
          jumpRow >= 0 &&
          jumpRow < board.size &&
          jumpCol >= 0 &&
          jumpCol < board.size &&
          midRow >= 0 &&
          midRow < board.size &&
          midCol >= 0 &&
          midCol < board.size
        ) {
          const midPiece = board.grid[midRow][midCol]
          const opponent = player === 1 ? 2 : 1

          if (midPiece === opponent && board.grid[jumpRow][jumpCol] === 0) {
            moves.push({
              from: position,
              to: { row: jumpRow, col: jumpCol },
              captured: { row: midRow, col: midCol },
            })
          }
        }
      }

      return moves
    },
    []
  )

  // User actions
  const selectPosition = useCallback(
    (position: Position) => {
      if (!gameState || !isPlayerTurn || aiThinking) return

      const piece = gameState.board.grid[position.row][position.col]

      if (piece === 1) {
        // Select own piece
        setSelectedPosition(position)
        const moves = calculateValidMoves(gameState.board, position, 1)
        setValidMoves(moves)
        playSound('click')
      } else if (selectedPosition && validMoves.length > 0) {
        // Try to move to this position
        const move = validMoves.find(
          (m) => m.to.row === position.row && m.to.col === position.col
        )
        if (move) {
          // Save current state for potential rollback
          previousStateRef.current = gameState

          // Optimistic update - apply move locally immediately
          const newState = applyMoveLocally(move)
          if (newState) {
            setGameState(newState)
            playSound('move')

            // Set AI thinking if in PvE mode
            if (gameMode === 'pve') {
              setAiThinkingDebounced(true)
            }
          }

          // Send move to server
          wsClient.makeMove(selectedPosition, position, move.captured)
          setSelectedPosition(null)
          setValidMoves([])
        }
      }
    },
    [gameState, isPlayerTurn, aiThinking, selectedPosition, validMoves, calculateValidMoves, playSound, applyMoveLocally, gameMode, setAiThinkingDebounced]
  )

  const makeMove = useCallback(
    (to: Position) => {
      if (!selectedPosition || !gameState) return

      const move = validMoves.find(
        (m) => m.to.row === to.row && m.to.col === to.col
      )

      if (move) {
        // Save current state for potential rollback
        previousStateRef.current = gameState

        // Optimistic update
        const newState = applyMoveLocally(move)
        if (newState) {
          setGameState(newState)
          playSound('move')

          if (gameMode === 'pve') {
            setAiThinkingDebounced(true)
          }
        }

        wsClient.makeMove(selectedPosition, to, move.captured)
        setSelectedPosition(null)
        setValidMoves([])
      }
    },
    [selectedPosition, validMoves, gameState, applyMoveLocally, playSound, gameMode, setAiThinkingDebounced]
  )

  const forfeit = useCallback(() => {
    wsClient.forfeit()
  }, [])

  const requestRematch = useCallback(() => {
    wsClient.requestRematch()
  }, [])

  const acceptRematch = useCallback(() => {
    wsClient.acceptRematch()
  }, [])

  const declineRematch = useCallback(() => {
    wsClient.declineRematch()
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const sendChatMessage = useCallback((message: string) => {
    if (message.trim()) {
      wsClient.sendChatMessage(message.trim())
    }
  }, [])

  return {
    gameState,
    selectedPosition,
    validMoves,
    isPlayerTurn,
    isLoading,
    error,
    gameOver,
    aiThinking,
    gameMode,
    pvpType,
    difficulty,
    timeControl,
    playerOneUsername,
    playerTwoUsername,
    rematch,
    connectionStatus,
    chatMessages,
    selectPosition,
    makeMove,
    forfeit,
    requestRematch,
    acceptRematch,
    declineRematch,
    clearError,
    sendChatMessage,
  }
}

export default useGame
