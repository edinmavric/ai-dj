import React from 'react'
import styles from './SoundToggle.module.css'

interface SoundToggleProps {
  isMuted: boolean
  onToggle: () => void
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ isMuted, onToggle }) => {
  return (
    <button
      className={`${styles.toggle} ${isMuted ? styles.muted : ''}`}
      onClick={onToggle}
      title={isMuted ? 'Sound Off - Click to enable' : 'Sound On - Click to mute'}
      aria-label={isMuted ? 'Enable sound' : 'Mute sound'}
    >
      {isMuted ? (
        // Muted icon (speaker with X)
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        // Sound on icon (speaker with waves)
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  )
}

export default SoundToggle
