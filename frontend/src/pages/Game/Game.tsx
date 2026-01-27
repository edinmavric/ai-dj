import React, { useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GameBoard, GameStatus, GameClock, CapturedPieces, MoveHistoryPanel, ChatPanel, ReplayControls, GameOverOverlay } from '../../components/game'
import { ConnectionBanner } from '../../components/common'
import { useGame } from '../../hooks/useGame'
import { useSound } from '../../hooks/useSound'
import { useReplay } from '../../hooks/useReplay'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Game.module.css'

export const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isMuted, toggleMuted } = useSound()

  const {
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
    forfeit,
    requestRematch,
    acceptRematch,
    declineRematch,
    sendChatMessage,
  } = useGame({
    gameId: gameId || '',
  })

  // Replay mode hook
  const {
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
  } = useReplay({
    moves: gameState?.move_history || [],
    boardSize: gameState?.board.size || 5,
  })

  const hasTimeControl = timeControl !== null

  // Keyboard navigation for replay mode
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keys in replay mode, unless it's to enter replay mode
    if (!replayState.isActive) {
      // Enter replay mode with 'r' key when game is over
      if (e.key === 'r' && gameOver && gameState?.move_history && gameState.move_history.length > 0) {
        e.preventDefault()
        enterReplayMode()
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        exitReplayMode()
        break
      case ' ':
        e.preventDefault()
        replayTogglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        replayPrev()
        break
      case 'ArrowRight':
        e.preventDefault()
        replayNext()
        break
      case 'Home':
        e.preventDefault()
        replayFirst()
        break
      case 'End':
        e.preventDefault()
        replayLast()
        break
    }
  }, [replayState.isActive, gameOver, gameState?.move_history, enterReplayMode, exitReplayMode, replayTogglePlay, replayPrev, replayNext, replayFirst, replayLast])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Create a display game state that uses replay board when in replay mode
  const displayGameState = useMemo(() => {
    if (!gameState) return null
    if (!replayState.isActive || !replayBoard) return gameState

    // In replay mode, overlay the replay board onto the game state
    return {
      ...gameState,
      board: {
        ...gameState.board,
        grid: replayBoard,
      },
    }
  }, [gameState, replayState.isActive, replayBoard])

  // Navigate to new game when rematch is created/accepted
  useEffect(() => {
    if (rematch.newGameId) {
      navigate(`/game/${rematch.newGameId}`)
    }
  }, [rematch.newGameId, navigate])

  if (!gameId) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Game not found</h2>
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading game...</p>
        </div>
      </div>
    )
  }

  if (error && !gameState) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Game not found</h2>
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  const handleRematch = () => {
    requestRematch()
  }

  const handleNewGame = () => {
    navigate('/')
  }

  const isLocalPvP = gameMode === 'pvp' && pvpType === 'local'
  const isOnlinePvP = gameMode === 'pvp' && pvpType !== 'local'

  // Get the player's rating change
  const playerRatingChange = gameOver?.rating_changes?.player_one || null

  return (
    <div className={styles.container}>
      <div className={styles.gameLayout}>
        <div className={styles.boardSection}>
          {/* Opponent/AI Clock (Player 2) - Top */}
          <div className={styles.playerInfo}>
            {hasTimeControl && (
              <GameClock
                timeMs={timeControl.playerTwoTimeMs}
                isActive={timeControl.clockRunning && gameState?.current_player === 2}
                playerName={playerTwoUsername}
                isCurrentPlayer={false}
                increment={timeControl.incrementSeconds}
              />
            )}
            <div className={styles.capturedContainer}>
              <span className={styles.capturedLabel}>Captured:</span>
              <CapturedPieces moves={gameState.move_history} capturedByPlayer={2} />
            </div>
          </div>

          <GameBoard
            gameState={displayGameState!}
            onCellClick={replayState.isActive ? undefined : selectPosition}
            selectedPosition={replayState.isActive ? null : selectedPosition}
            validMoves={replayState.isActive ? [] : validMoves}
            isPlayerTurn={replayState.isActive ? false : isPlayerTurn}
            aiThinking={aiThinking}
            disableOverlays={replayState.isActive || !!gameOver}
            isLocalPvP={gameMode === 'pvp' && pvpType === 'local'}
          />

          {/* Player Clock (Player 1) - Bottom */}
          <div className={styles.playerInfo}>
            <div className={styles.capturedContainer}>
              <span className={styles.capturedLabel}>Captured:</span>
              <CapturedPieces moves={gameState.move_history} capturedByPlayer={1} />
            </div>
            {hasTimeControl && (
              <GameClock
                timeMs={timeControl.playerOneTimeMs}
                isActive={timeControl.clockRunning && gameState?.current_player === 1}
                playerName={playerOneUsername}
                isCurrentPlayer={true}
                increment={timeControl.incrementSeconds}
              />
            )}
          </div>
        </div>

        <div className={styles.statusSection}>
          <ConnectionBanner status={connectionStatus} />

          <GameStatus
            gameState={gameState}
            isPlayerTurn={isPlayerTurn}
            aiThinking={aiThinking}
            gameOver={gameOver}
            gameMode={gameMode || 'pve'}
            difficulty={difficulty || 1}
            playerOneUsername={playerOneUsername}
            playerTwoUsername={playerTwoUsername}
            isMuted={isMuted}
            onToggleSound={toggleMuted}
            onForfeit={isLocalPvP || gameOver ? undefined : forfeit}
            onRematch={handleRematch}
            onNewGame={handleNewGame}
            isLocalPvP={isLocalPvP}
          />

          {/* Replay Controls */}
          {replayState.isActive ? (
            <ReplayControls
              currentIndex={replayState.currentIndex}
              totalMoves={gameState.move_history.length}
              isPlaying={replayState.isPlaying}
              onFirst={replayFirst}
              onPrev={replayPrev}
              onTogglePlay={replayTogglePlay}
              onNext={replayNext}
              onLast={replayLast}
              onSeek={replayGoTo}
              onExit={exitReplayMode}
            />
          ) : (
            gameOver && gameState.move_history.length > 0 && (
              <button className={styles.replayButton} onClick={enterReplayMode}>
                View Replay
              </button>
            )
          )}

          {/* Rematch Request Dialog (for PvP) */}
          {rematch.requested && gameMode === 'pvp' && (
            <div className={styles.rematchDialog}>
              <p>Opponent wants a rematch!</p>
              <div className={styles.rematchButtons}>
                <button className={styles.acceptButton} onClick={acceptRematch}>
                  Accept
                </button>
                <button className={styles.declineButton} onClick={declineRematch}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Rematch Declined Message */}
          {rematch.declined && (
            <div className={styles.rematchDeclined}>
              Rematch declined. Start a new game from home.
            </div>
          )}

          {error && <div className={styles.errorBanner}>{error}</div>}

          <MoveHistoryPanel
            moves={gameState.move_history}
            currentMoveIndex={replayState.isActive ? replayState.currentIndex : null}
            isReplayMode={replayState.isActive}
            boardSize={gameState.board.size}
            onMoveClick={replayState.isActive ? replayGoTo : undefined}
          />

          {/* Chat Panel (Online PvP only - not local) */}
          {isOnlinePvP && (
            <ChatPanel
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              currentUserId={user?.id}
              playerOneUsername={playerOneUsername}
              playerTwoUsername={playerTwoUsername}
              disabled={false}
            />
          )}

          <div className={styles.instructions}>
            <h3>How to Play</h3>
            <ul>
              <li>Click a piece to select it</li>
              <li>Green dots show valid moves</li>
              <li>Red rings indicate capture moves</li>
              <li>Capture all enemy pieces to win!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameOver && !replayState.isActive && (
        <GameOverOverlay
          gameOver={gameOver}
          gameMode={gameMode || 'pve'}
          pvpType={pvpType}
          timeControl={timeControl?.category || null}
          difficulty={difficulty || 1}
          playerOneUsername={playerOneUsername}
          playerTwoUsername={playerTwoUsername}
          playerRatingChange={playerRatingChange}
          onRematch={handleRematch}
          onNewGame={handleNewGame}
        />
      )}
    </div>
  )
}

export default Game
