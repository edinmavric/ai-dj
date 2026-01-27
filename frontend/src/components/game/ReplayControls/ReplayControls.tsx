import React, { useEffect, useRef } from 'react'
import styles from './ReplayControls.module.css'

interface ReplayControlsProps {
  currentIndex: number
  totalMoves: number
  isPlaying: boolean
  onFirst: () => void
  onPrev: () => void
  onTogglePlay: () => void
  onNext: () => void
  onLast: () => void
  onSeek: (index: number) => void
  onExit: () => void
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  currentIndex,
  totalMoves,
  isPlaying,
  onFirst,
  onPrev,
  onTogglePlay,
  onNext,
  onLast,
  onSeek,
  onExit,
}) => {
  const sliderRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          onPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          onNext()
          break
        case ' ':
          e.preventDefault()
          onTogglePlay()
          break
        case 'Home':
          e.preventDefault()
          onFirst()
          break
        case 'End':
          e.preventDefault()
          onLast()
          break
        case 'Escape':
          e.preventDefault()
          onExit()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFirst, onPrev, onTogglePlay, onNext, onLast, onExit])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseInt(e.target.value, 10))
  }

  // Calculate display values
  // currentIndex = -1 means initial state (before any moves)
  const displayMoveNumber = currentIndex + 1
  const progressPercent = totalMoves > 0 ? ((currentIndex + 1) / totalMoves) * 100 : 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Replay Mode</span>
        <button className={styles.exitButton} onClick={onExit}>
          Exit Replay
        </button>
      </div>

      <div className={styles.controls}>
        <button
          className={styles.controlButton}
          onClick={onFirst}
          disabled={currentIndex <= -1}
          title="First move (Home)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" />
          </svg>
        </button>

        <button
          className={styles.controlButton}
          onClick={onPrev}
          disabled={currentIndex <= -1}
          title="Previous move (Left Arrow)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <button
          className={`${styles.controlButton} ${styles.playButton}`}
          onClick={onTogglePlay}
          disabled={totalMoves === 0}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          className={styles.controlButton}
          onClick={onNext}
          disabled={currentIndex >= totalMoves - 1}
          title="Next move (Right Arrow)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>

        <button
          className={styles.controlButton}
          onClick={onLast}
          disabled={currentIndex >= totalMoves - 1}
          title="Last move (End)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z" />
          </svg>
        </button>
      </div>

      <div className={styles.timeline}>
        <input
          ref={sliderRef}
          type="range"
          min="-1"
          max={totalMoves - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className={styles.slider}
          style={{
            background: `linear-gradient(to right, #7c3aed ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%)`,
          }}
        />
        <div className={styles.moveCounter}>
          {displayMoveNumber === 0 ? 'Start' : `Move ${displayMoveNumber}`} / {totalMoves}
        </div>
      </div>

      <div className={styles.shortcuts}>
        <span>Shortcuts: ← → navigate | Space play/pause | Esc exit</span>
      </div>
    </div>
  )
}

export default ReplayControls
