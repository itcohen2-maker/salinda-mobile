import * as React from 'react'

import { createSoundEngine, type SoundCueId } from './soundEngine'

type SoundContextValue = {
  arm: () => Promise<boolean>
  muted: boolean
  playCue: (cue: SoundCueId) => void
  toggleMuted: () => void
}

const SOUND_STORAGE_KEY = 'hidden-rule-sound-muted'

const SoundContext = React.createContext<SoundContextValue | null>(null)

function readInitialMutedState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SOUND_STORAGE_KEY) === '1'
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const engineRef = React.useRef(createSoundEngine())
  const [muted, setMuted] = React.useState(readInitialMutedState)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(SOUND_STORAGE_KEY, muted ? '1' : '0')
  }, [muted])

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const arm = () => {
      void engineRef.current.arm()
    }

    window.addEventListener('pointerdown', arm, { passive: true, capture: true })
    window.addEventListener('keydown', arm, { passive: true, capture: true })

    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true } as EventListenerOptions)
      window.removeEventListener('keydown', arm, { capture: true } as EventListenerOptions)
    }
  }, [])

  const value = React.useMemo<SoundContextValue>(
    () => ({
      arm: () => engineRef.current.arm(),
      muted,
      playCue: (cue) => {
        if (muted) {
          return
        }

        engineRef.current.play(cue)
      },
      toggleMuted: () => {
        setMuted((current) => !current)
      },
    }),
    [muted],
  )

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  )
}

export function useGameSound() {
  const context = React.useContext(SoundContext)
  if (!context) {
    throw new Error('useGameSound must be used within SoundProvider')
  }

  return context
}
