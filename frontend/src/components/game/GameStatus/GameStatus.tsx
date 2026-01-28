import React from 'react'
import { GameState } from '../../../types/game'
import { GameOverMessage } from '../../../types/websocket'
import { SoundToggle } from '../../common'
import styles from './GameStatus.module.css'

interface GameStatusProps {
  gameState: GameState
  isPlayerTurn: boolean
  aiThinking: boolean
  gameOver: GameOverMessage | null
  gameMode: 'pve' | 'pvp'
  difficulty: number
  playerOneUsername?: string
  playerTwoUsername?: string
  isMuted?: boolean
  onToggleSound?: () => void
  onForfeit?: () => void
  onRematch: () => void
  onNewGame?: () => void
  isLocalPvP?: boolean
}

const DIFFICULTY_NAMES: Record<number, { name: string; character: string; rating: number }> = {
  1: { name: 'Easy', character: 'Demogorgon', rating: 600 },
  2: { name: 'Medium', character: 'Alpha AI', rating: 1000 },
  3: { name: 'Hard', character: 'Shadow Monster', rating: 1400 },
  4: { name: 'Nightmare', character: 'Mind Flayer', rating: 1800 },
}

export const GameStatus: React.FC<GameStatusProps> = ({
  gameState,
  isPlayerTurn,
  aiThinking,
  gameOver,
  gameMode,
  difficulty,
  playerOneUsername = 'Player 1',
  playerTwoUsername = 'Player 2',
  isMuted = false,
  onToggleSound,
  onForfeit,
  onRematch,
  onNewGame,
  isLocalPvP = false,
}) => {
  const isPvP = gameMode === 'pvp'
  const difficultyInfo = DIFFICULTY_NAMES[difficulty] || DIFFICULTY_NAMES[1]

  // Use actual usernames or fallback to defaults
  const p1Name = playerOneUsername || 'Player 1'
  const p2Name = isPvP ? (playerTwoUsername || 'Player 2') : difficultyInfo.character

  const getStatusText = (): string => {
    if (gameOver) {
      if (isPvP) {
        return gameOver.winner === 1 ? `${p1Name} wins!` : `${p2Name} wins!`
      }
      return gameOver.ai_won ? `${difficultyInfo.character} wins!` : 'You win!'
    }
    if (aiThinking) {
      return `${difficultyInfo.character} is thinking...`
    }
    if (isPvP) {
      return isPlayerTurn ? `${p1Name}'s turn` : `${p2Name}'s turn`
    }
    return isPlayerTurn ? 'Your turn' : "Opponent's turn"
  }

  const countPieces = (player: 1 | 2): number => {
    return gameState.board.grid.flat().filter((cell) => cell === player).length
  }

  const getModeLabel = (): string => {
    if (isPvP) {
      return 'Player vs Player'
    }
    return `${difficultyInfo.character} (${difficultyInfo.rating})`
  }

  const getOpponentLabel = (): string => {
    if (!isPvP) {
      return `${difficultyInfo.character} (${difficultyInfo.rating})`
    }
    return p2Name
  }

  const getPlayerLabel = (): string => {
    if (isPvP) {
      return p1Name
    }
    return 'Eleven'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h2 className={styles.title}>Stranger Things</h2>
          {onToggleSound && (
            <SoundToggle isMuted={isMuted} onToggle={onToggleSound} />
          )}
        </div>
        <span className={styles.difficulty}>{getModeLabel()}</span>
      </div>

      <div className={styles.scores}>
        <div className={`${styles.scoreCard} ${styles.player}`}>
          <span className={styles.label}>{getPlayerLabel()}</span>
          <span className={styles.count}>{countPieces(1)}</span>
        </div>
        <div className={styles.vs}>VS</div>
        <div className={`${styles.scoreCard} ${styles.ai}`}>
          <span className={styles.label}>{getOpponentLabel()}</span>
          <span className={styles.count}>{countPieces(2)}</span>
        </div>
      </div>

      <div
        className={`${styles.status} ${
          gameOver ? (gameOver.ai_won ? styles.lose : styles.win) : ''
        }`}
      >
        <span className={styles.statusText}>{getStatusText()}</span>
        <span className={styles.turn}>Turn {gameState.turn_number}</span>
      </div>

      {/* Actions - hide during game over (overlay handles it) */}
      {!gameOver && gameState.phase !== 'finished' && (
        <div className={styles.actions}>
          {onForfeit && !isLocalPvP && (
            <button className={styles.forfeitButton} onClick={onForfeit}>
              Forfeit
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default GameStatus
