import React, { useState, useRef, useEffect } from 'react'
import { ChatMessageData } from '../../../types/websocket'
import styles from './ChatPanel.module.css'

interface ChatPanelProps {
  messages: ChatMessageData[]
  onSendMessage: (message: string) => void
  currentUserId?: string
  playerOneUsername: string
  playerTwoUsername: string
  disabled?: boolean
}

const MAX_MESSAGE_LENGTH = 200

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  currentUserId,
  playerOneUsername,
  playerTwoUsername,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const getUsername = (playerId: string): string => {
    // Determine username based on player ID
    // Player 1 is typically the current user, player 2 is opponent
    if (playerId === currentUserId || playerId === '1') {
      return playerOneUsername
    }
    return playerTwoUsername
  }

  const isOwnMessage = (playerId: string): boolean => {
    return playerId === currentUserId || playerId === '1'
  }

  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (disabled) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Chat</span>
        </div>
        <div className={styles.disabledMessage}>
          Chat is only available in PvP games
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Chat</span>
        <span className={styles.messageCount}>{messages.length}</span>
      </div>

      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg, index) => {
            const own = isOwnMessage(msg.player_id)
            // Use timestamp + player_id + index as unique key (timestamp alone may have collisions)
            const messageKey = `${msg.timestamp || ''}-${msg.player_id}-${index}`
            return (
              <div
                key={messageKey}
                className={`${styles.message} ${own ? styles.own : styles.opponent}`}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.username}>
                    {own ? 'You' : getUsername(msg.player_id)}
                  </span>
                  <span className={styles.timestamp}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className={styles.messageContent}>{msg.message}</div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className={styles.input}
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputValue.trim()}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>

      {inputValue.length > 0 && (
        <div className={styles.charCount}>
          {inputValue.length}/{MAX_MESSAGE_LENGTH}
        </div>
      )}
    </div>
  )
}

export default ChatPanel
