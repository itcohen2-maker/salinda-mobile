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

  return (
    <div style={{ minHeight: '100vh', background: '#0D0F13', direction: 'rtl' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          padding: '12px 18px',
          background: 'rgba(13, 15, 19, 0.86)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(236, 228, 208, 0.06)',
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            display: 'grid',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: '"Frank Ruhl Libre", Georgia, serif',
              fontSize: 12,
              lineHeight: 1.3,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(214, 179, 108, 0.82)',
              fontWeight: 500,
            }}
          >
            Hidden Rule / אבטיפוס פעיל
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div
              style={{
                fontFamily: '"Frank Ruhl Libre", Georgia, serif',
                fontSize: 12,
                lineHeight: 1.3,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(207, 198, 184, 0.62)',
              }}
            >
              {`פרק ${chapter.chapterIndex + 1} מתוך ${chapter.chapterCount} / ${phaseLabel}`}
            </div>
            <SecondaryButton
              label="חזור לפרק הראשון"
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
        </div>
      </div>

      {format === 'mobile'
        ? chapter.screen === 'rule-naming'
          ? <RuleNamingScreen viewModel={chapter.namingViewModel} />
          : <GameplayScreen viewModel={chapter.gameplayViewModel} />
        : chapter.screen === 'rule-naming'
          ? <WebRuleNamingScreen viewModel={chapter.namingViewModel} />
          : <WebGameplayScreen viewModel={chapter.gameplayViewModel} />}
    </div>
  )
}
