import React, { useEffect, useRef } from 'react'
import { Move } from '../../../types/game'
import { moveToNotation, formatMoveNumber } from '../../../utils/moveNotation'
import styles from './MoveHistoryPanel.module.css'

interface MoveHistoryPanelProps {
  moves: Move[]
  currentMoveIndex: number | null // null = live game, number = replay position
  onMoveClick?: (index: number) => void
  isReplayMode: boolean
  boardSize?: number
}

export const MoveHistoryPanel: React.FC<MoveHistoryPanelProps> = ({
  moves,
  currentMoveIndex,
  onMoveClick,
  isReplayMode,
  boardSize = 5,
}) => {
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest move when not in replay mode
  useEffect(() => {
    if (!isReplayMode && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [moves.length, isReplayMode])

  // Group moves into pairs (player 1 move, player 2 move)
  const movePairs: Array<{ p1Move?: Move; p2Move?: Move; p1Index: number; p2Index: number }> = []
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      p1Move: moves[i],
      p2Move: moves[i + 1],
      p1Index: i,
      p2Index: i + 1,
    })
  }

  const handleMoveClick = (index: number) => {
    if (onMoveClick && isReplayMode) {
      onMoveClick(index)
    }
  }

  if (moves.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Move History</h3>
        </div>
        <div className={styles.empty}>No moves yet</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Move History</h3>
        <span className={styles.moveCount}>{moves.length} moves</span>
      </div>
      <div className={styles.list} ref={listRef}>
        {movePairs.map((pair, pairIndex) => (
          <div key={pairIndex} className={styles.moveRow}>
            <span className={styles.moveNumber}>{formatMoveNumber(pair.p1Index)}</span>
            {pair.p1Move && (
              <button
                className={`${styles.move} ${styles.player1} ${
                  isReplayMode && currentMoveIndex === pair.p1Index ? styles.current : ''
                } ${pair.p1Move.captured ? styles.capture : ''}`}
                onClick={() => handleMoveClick(pair.p1Index)}
                disabled={!isReplayMode}
              >
                {moveToNotation(pair.p1Move, boardSize)}
              </button>
            )}
            {pair.p2Move && (
              <button
                className={`${styles.move} ${styles.player2} ${
                  isReplayMode && currentMoveIndex === pair.p2Index ? styles.current : ''
                } ${pair.p2Move.captured ? styles.capture : ''}`}
                onClick={() => handleMoveClick(pair.p2Index)}
                disabled={!isReplayMode}
              >
                {moveToNotation(pair.p2Move, boardSize)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MoveHistoryPanel
