import React, { useEffect, useState, useRef } from 'react'
import styles from './GameClock.module.css'

interface GameClockProps {
  timeMs: number
  isActive: boolean
  playerName: string
  isCurrentPlayer: boolean
  increment?: number
}

export const GameClock: React.FC<GameClockProps> = ({
  timeMs,
  isActive,
  playerName,
  isCurrentPlayer,
  increment = 0,
}) => {
  const [displayTime, setDisplayTime] = useState(timeMs)
  const lastUpdateRef = useRef<number>(Date.now())
  const animationFrameRef = useRef<number>()

  // Update display time when props change
  useEffect(() => {
    setDisplayTime(timeMs)
    lastUpdateRef.current = Date.now()
  }, [timeMs])

  // Local countdown for smooth display
  useEffect(() => {
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const tick = () => {
      const now = Date.now()
      const elapsed = now - lastUpdateRef.current
      lastUpdateRef.current = now

      setDisplayTime((prev) => Math.max(0, prev - elapsed))
      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isActive])

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    // Show tenths when under 20 seconds
    if (totalSeconds < 20) {
      return `${seconds}.${tenths}`
    }
    return `0:${seconds.toString().padStart(2, '0')}`
  }

  const isLow = displayTime < 30000 // 30 seconds
  const isCritical = displayTime < 10000 // 10 seconds

  return (
    <div
      className={`${styles.clock} ${isActive ? styles.active : ''} ${
        isCurrentPlayer ? styles.currentPlayer : ''
      } ${isLow ? styles.low : ''} ${isCritical ? styles.critical : ''}`}
    >
      <div className={styles.playerName}>{playerName}</div>
      <div className={styles.time}>{formatTime(displayTime)}</div>
      {increment > 0 && <div className={styles.increment}>+{increment}s</div>}
    </div>
  )
}

export default GameClock
