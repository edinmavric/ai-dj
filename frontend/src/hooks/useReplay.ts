import { useState, useCallback, useEffect, useRef } from 'react'
import { Move } from '../types/game'
import { reconstructBoardAtMove } from '../utils/boardReconstruction'

interface ReplayState {
  isActive: boolean
  currentIndex: number  // -1 = initial state, 0 = after first move, etc.
  isPlaying: boolean
  playbackSpeed: number  // milliseconds between moves
}

interface UseReplayOptions {
  moves: Move[]
  boardSize: number
  onBoardChange?: (board: number[][]) => void
}

interface UseReplayReturn {
  replayState: ReplayState
  replayBoard: number[][] | null
  enterReplayMode: () => void
  exitReplayMode: () => void
  replayGoTo: (index: number) => void
  replayNext: () => void
  replayPrev: () => void
  replayFirst: () => void
  replayLast: () => void
  replayTogglePlay: () => void
  setPlaybackSpeed: (speed: number) => void
}

const DEFAULT_PLAYBACK_SPEED = 1000  // 1 second per move

export function useReplay({
  moves,
  boardSize,
  onBoardChange,
}: UseReplayOptions): UseReplayReturn {
  const [replayState, setReplayState] = useState<ReplayState>({
    isActive: false,
    currentIndex: -1,
    isPlaying: false,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  })

  const [replayBoard, setReplayBoard] = useState<number[][] | null>(null)
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
      }
    }
  }, [])

  // Handle auto-playback
  useEffect(() => {
    if (replayState.isActive && replayState.isPlaying) {
      playbackIntervalRef.current = setInterval(() => {
        setReplayState((prev) => {
          // Stop at the end
          if (prev.currentIndex >= moves.length - 1) {
            if (playbackIntervalRef.current) {
              clearInterval(playbackIntervalRef.current)
              playbackIntervalRef.current = null
            }
            return { ...prev, isPlaying: false }
          }
          return { ...prev, currentIndex: prev.currentIndex + 1 }
        })
      }, replayState.playbackSpeed)

      return () => {
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current)
          playbackIntervalRef.current = null
        }
      }
    }
  }, [replayState.isActive, replayState.isPlaying, replayState.playbackSpeed, moves.length])

  // Update board when index changes
  useEffect(() => {
    if (replayState.isActive) {
      const board = reconstructBoardAtMove(boardSize, moves, replayState.currentIndex)
      setReplayBoard(board)
      onBoardChange?.(board)
    }
  }, [replayState.isActive, replayState.currentIndex, boardSize, moves, onBoardChange])

  const enterReplayMode = useCallback(() => {
    // Start at the end (current position)
    const lastIndex = moves.length - 1
    setReplayState({
      isActive: true,
      currentIndex: lastIndex,
      isPlaying: false,
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    })
  }, [moves.length])

  const exitReplayMode = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
    setReplayState({
      isActive: false,
      currentIndex: -1,
      isPlaying: false,
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    })
    setReplayBoard(null)
  }, [])

  const replayGoTo = useCallback((index: number) => {
    // Clamp index to valid range
    const clampedIndex = Math.max(-1, Math.min(index, moves.length - 1))
    setReplayState((prev) => ({
      ...prev,
      currentIndex: clampedIndex,
      isPlaying: false,  // Stop playback when manually seeking
    }))
  }, [moves.length])

  const replayNext = useCallback(() => {
    setReplayState((prev) => {
      if (prev.currentIndex >= moves.length - 1) return prev
      return { ...prev, currentIndex: prev.currentIndex + 1 }
    })
  }, [moves.length])

  const replayPrev = useCallback(() => {
    setReplayState((prev) => {
      if (prev.currentIndex <= -1) return prev
      return { ...prev, currentIndex: prev.currentIndex - 1 }
    })
  }, [])

  const replayFirst = useCallback(() => {
    setReplayState((prev) => ({
      ...prev,
      currentIndex: -1,
      isPlaying: false,
    }))
  }, [])

  const replayLast = useCallback(() => {
    setReplayState((prev) => ({
      ...prev,
      currentIndex: moves.length - 1,
      isPlaying: false,
    }))
  }, [moves.length])

  const replayTogglePlay = useCallback(() => {
    setReplayState((prev) => {
      // If at the end and pressing play, restart from beginning
      if (prev.currentIndex >= moves.length - 1 && !prev.isPlaying) {
        return { ...prev, currentIndex: -1, isPlaying: true }
      }
      return { ...prev, isPlaying: !prev.isPlaying }
    })
  }, [moves.length])

  const setPlaybackSpeed = useCallback((speed: number) => {
    setReplayState((prev) => ({ ...prev, playbackSpeed: speed }))
  }, [])

  return {
    replayState,
    replayBoard,
    enterReplayMode,
    exitReplayMode,
    replayGoTo,
    replayNext,
    replayPrev,
    replayFirst,
    replayLast,
    replayTogglePlay,
    setPlaybackSpeed,
  }
}

export default useReplay
