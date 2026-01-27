import React from 'react'
import { OnlinePlayer } from '../../../websocket/lobbyClient'
import styles from './OnlinePlayersPanel.module.css'

interface OnlinePlayersPanelProps {
  players: OnlinePlayer[]
  count: number
  isConnected: boolean
}

export const OnlinePlayersPanel: React.FC<OnlinePlayersPanelProps> = ({
  players,
  count,
  isConnected,
}) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Online Players</span>
        <span className={`${styles.status} ${isConnected ? styles.connected : styles.disconnected}`}>
          {isConnected ? `${count} online` : 'Connecting...'}
        </span>
      </div>
      {isConnected && players.length > 0 ? (
        <ul className={styles.playerList}>
          {players.map((player) => (
            <li key={player.user_id} className={styles.player}>
              <span className={styles.playerName}>{player.username}</span>
              <span className={styles.playerRating}>{player.rating}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          {isConnected ? 'No players online' : 'Connecting to lobby...'}
        </div>
      )}
    </div>
  )
}

export default OnlinePlayersPanel
