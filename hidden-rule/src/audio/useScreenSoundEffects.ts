import * as React from 'react'

import type { GameplayViewModel, RuleNamingViewModel } from '../screens/viewModels'
import { useGameSound } from './SoundProvider'
import type { SoundCueId } from './soundEngine'

const recentTriggerMap = new Map<string, number>()

function useTriggeredCue(triggerKey: string | undefined, cue: SoundCueId | undefined) {
  const { playCue } = useGameSound()

  React.useEffect(() => {
    if (!triggerKey || !cue) {
      return
    }

    const recentAt = recentTriggerMap.get(triggerKey)
    const now = Date.now()
    if (recentAt && now - recentAt < 300) {
      return
    }

    recentTriggerMap.set(triggerKey, now)
    playCue(cue)
  }, [cue, playCue, triggerKey])
}

export function useGameplaySoundEffects(state: GameplayViewModel) {
  useTriggeredCue(state.motion?.verdictKey, state.verdict?.result === 'accepted' ? 'acceptedVerdict' : state.verdict ? 'rejectedVerdict' : undefined)
  useTriggeredCue(state.motion?.ledgerKey, state.motion?.ledgerKey ? 'ledgerEntry' : undefined)
  useTriggeredCue(state.motion?.readyKey, state.motion?.readyKey ? 'readyToName' : undefined)
}

export function useNamingSoundEffects(state: RuleNamingViewModel) {
  useTriggeredCue(state.motion?.entryKey, state.motion?.entryKey ? 'namingOpen' : undefined)
  useTriggeredCue(
    state.motion?.submissionKey,
    state.motion?.submissionKey
      ? state.notice?.tone === 'accepted'
        ? 'submitAccepted'
        : 'submitRejected'
      : undefined,
  )
}
