import { useCallback, useRef, useEffect, useState } from 'react'

type SoundName = 'move' | 'capture' | 'win' | 'lose' | 'error' | 'click'

interface SoundConfig {
  src: string
  volume: number
}

const SOUNDS: Record<SoundName, SoundConfig> = {
  move: { src: '/assets/sounds/move.mp3', volume: 0.5 },
  capture: { src: '/assets/sounds/capture.mp3', volume: 0.7 },
  win: { src: '/assets/sounds/win.mp3', volume: 0.8 },
  lose: { src: '/assets/sounds/lose.mp3', volume: 0.6 },
  error: { src: '/assets/sounds/error.mp3', volume: 0.4 },
  click: { src: '/assets/sounds/click.mp3', volume: 0.3 },
}

const SOUND_MUTED_KEY = 'sound_muted'

interface UseSoundReturn {
  playSound: (name: SoundName) => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
  isMuted: boolean
}

export function useSound(): UseSoundReturn {
  const audioCache = useRef<Map<SoundName, HTMLAudioElement>>(new Map())
  const loadedSounds = useRef<Set<SoundName>>(new Set())
  const soundsDisabled = useRef(false)

  // Initialize muted state from localStorage
  const [isMuted, setIsMutedState] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SOUND_MUTED_KEY) === 'true'
  })

  // Keep ref in sync with state for use in playSound callback
  const mutedRef = useRef(isMuted)
  useEffect(() => {
    mutedRef.current = isMuted
  }, [isMuted])

  // Preload sounds - silently skip if files don't exist
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([name, config]) => {
      const audio = new Audio()
      audio.volume = config.volume
      audio.preload = 'auto'

      // Only add to cache if sound loads successfully
      audio.oncanplaythrough = () => {
        loadedSounds.current.add(name as SoundName)
      }

      audio.onerror = () => {
        // Sound file doesn't exist - silently skip
        // Don't log errors to avoid console spam
      }

      audio.src = config.src
      audioCache.current.set(name as SoundName, audio)
    })

    // Disable sounds entirely if none load after a short delay
    const checkTimer = setTimeout(() => {
      if (loadedSounds.current.size === 0) {
        soundsDisabled.current = true
      }
    }, 1000)

    return () => {
      clearTimeout(checkTimer)
      audioCache.current.forEach((audio) => {
        audio.pause()
        audio.src = ''
      })
      audioCache.current.clear()
      loadedSounds.current.clear()
    }
  }, [])

  const playSound = useCallback((name: SoundName) => {
    // Skip if muted, sounds disabled, or sound not loaded
    if (mutedRef.current || soundsDisabled.current) return
    if (!loadedSounds.current.has(name)) return

    const audio = audioCache.current.get(name)
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // Silently fail - autoplay might be blocked or file missing
      })
    }
  }, [])

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted
    setIsMutedState(muted)
    localStorage.setItem(SOUND_MUTED_KEY, String(muted))
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted(!mutedRef.current)
  }, [setMuted])

  return {
    playSound,
    setMuted,
    toggleMuted,
    isMuted,
  }
}

export default useSound
