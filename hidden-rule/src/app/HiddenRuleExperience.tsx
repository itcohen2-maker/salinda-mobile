import * as React from 'react'

import { SoundProvider, useGameSound } from '../audio'
import { SecondaryButton } from '../components/buttons'
import { usePrototypeChapter } from '../game'
import {
  GameplayScreen,
  RuleNamingScreen,
  WebGameplayScreen,
  WebRuleNamingScreen,
} from '../screens'

type ExperienceFormat = 'mobile' | 'web'

const EXPERIENCE_FORMATS: Array<{ id: ExperienceFormat; label: string }> = [
  { id: 'mobile', label: 'מובייל' },
  { id: 'web', label: 'ווב' },
]

export function HiddenRuleExperience() {
  return (
    <SoundProvider>
      <HiddenRuleExperienceFrame />
    </SoundProvider>
  )
}

function HiddenRuleExperienceFrame() {
  const [format, setFormat] = React.useState<ExperienceFormat>('mobile')
  const chapter = usePrototypeChapter()
  const sound = useGameSound()
  const phaseLabel = chapter.screen === 'rule-naming'
    ? 'ניחוש החוק'
    : chapter.gameplayVariant === 'ready-to-name'
      ? 'מוכן לניחוש'
      : chapter.gameplayVariant === 'after-check'
        ? 'אחרי בדיקה'
        : 'חקירה'

  const activeScreen = format === 'mobile'
    ? chapter.screen === 'rule-naming'
      ? <RuleNamingScreen viewModel={chapter.namingViewModel} />
      : <GameplayScreen viewModel={chapter.gameplayViewModel} />
    : chapter.screen === 'rule-naming'
      ? <WebRuleNamingScreen viewModel={chapter.namingViewModel} />
      : <WebGameplayScreen viewModel={chapter.gameplayViewModel} />

  return (
    <div className="preview-root">
      <header className="preview-toolbar">
        <div className="preview-toolbar__summary">
          <div className="preview-brand">Hidden Rule</div>
          <div className="preview-phase">{`פרק ${chapter.chapterIndex + 1} מתוך ${chapter.chapterCount} / ${phaseLabel}`}</div>
        </div>

        <div className="preview-address" aria-label="כתובת תצוגה">
          <span className="preview-lock" aria-hidden="true" />
          hidden-rule.local/{format}
        </div>

        <div className="preview-actions" aria-label="בקרות תצוגה">
          {EXPERIENCE_FORMATS.map((entry) => (
            <SecondaryButton
              key={entry.id}
              label={entry.label}
              state={format === entry.id ? 'selected' : 'idle'}
              onClick={() => {
                React.startTransition(() => {
                  setFormat(entry.id)
                })
              }}
            />
          ))}
          <SecondaryButton
            label="אתחול"
            onClick={chapter.restart}
          />
          <SecondaryButton
            label={sound.muted ? 'צליל כבוי' : 'צליל פעיל'}
            onClick={() => {
              void sound.arm()
              sound.toggleMuted()
            }}
            state={sound.muted ? 'idle' : 'selected'}
          />
        </div>
      </header>

      <main className={`preview-stage preview-stage--${format}`}>
        {format === 'mobile' ? (
          <div className="mobile-browser" aria-label="תצוגת מובייל בדפדפן">
            <div className="mobile-browser__bar">
              <span className="mobile-browser__dot" />
              <span className="mobile-browser__url">hidden-rule.local</span>
              <span className="mobile-browser__menu">•••</span>
            </div>
            <div className="mobile-browser__screen">
              {activeScreen}
            </div>
            <div className="mobile-browser__home" aria-hidden="true" />
          </div>
        ) : (
          activeScreen
        )}
      </main>
    </div>
  )
}
