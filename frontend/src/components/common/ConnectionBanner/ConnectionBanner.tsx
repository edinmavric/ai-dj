import React from 'react'
import styles from './ConnectionBanner.module.css'

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

interface ConnectionBannerProps {
  status: ConnectionStatus
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ status }) => {
  if (status === 'connected') {
    return null
  }

  return (
    <div className={`${styles.banner} ${styles[status]}`}>
      <span className={styles.icon}>
        {status === 'reconnecting' ? '...' : '!'}
      </span>
      <span className={styles.message}>
        {status === 'reconnecting'
          ? 'Reconnecting to server...'
          : 'Connection lost. Please refresh the page.'}
      </span>
    </div>
  )
}

export default ConnectionBanner
