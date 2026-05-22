import * as React from 'react'

import { createBackgroundStyle } from '../app/backgroundStyle'
import { useGameSound, useNamingSoundEffects } from '../audio'
import { PremiumButton } from '../components/buttons'
import {
  ChapterRail,
  EvidenceDigest,
  MicroActionRow,
  RuleChoiceSurface,
  SpecimenPair,
} from '../components/gameplay'
import {
  buildBackgroundRecipe,
  DEFAULT_BACKGROUND_PRESET_ID,
  FONT_STACKS,
} from '../theme'
import type { RuleNamingViewModel } from './viewModels'

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

export function WebRuleNamingScreen({
  viewModel,
}: {
  viewModel?: RuleNamingViewModel
}) {
  const state = viewModel ?? {
    actions: [
      { label: 'חזור למשחק' },
      { label: 'קח רמז' },
    ],
    counts: {
      contradicts: 3,
      satisfies: 4,
    },
    footer: 'בחירה / פתוחה',
    initialPrompt: 'יש מספיק ראיות. עכשיו בחר את החוק שמתאים לקלפים שעברו את הבדיקה.',
    introEyebrow: 'פרק III / רשומה 04',
    left: { catalog: 'II-03', glyph: 'ladder-rungs' },
    motion: {
      entryKey: 'static-web-naming-entry',
    },
    options: [
      {
        id: 'rule-1',
        label: 'הקלף מתאים לחוק רק אם יש פס אופקי ברור במרכז הסמל.',
      },
      {
        id: 'rule-2',
        label: 'הקלף מתאים לחוק רק אם יש שני סימנים זהים זה מול זה.',
      },
      {
        id: 'rule-3',
        label: 'הקלף מתאים לחוק רק אם הסמל פתוח ואינו נסגר לצורה מלאה.',
      },
    ],
    primaryAction: {
      disabled: true,
      label: 'אשר את הבחירה',
    },
    rail: {
      article: '04',
      chapter: 'III',
      label: 'כלל',
    },
    right: { catalog: 'III-04', glyph: 'cut-diamond' },
    title: 'בחירת החוק',
  }

  const sound = useGameSound()
  useNamingSoundEffects(state)

  const background = React.useMemo(
    () => createBackgroundStyle(buildBackgroundRecipe(DEFAULT_BACKGROUND_PRESET_ID, 'rulesMeta')),
    [],
  )

  const noticeTone = state.notice?.tone ?? 'neutral'
  const noticeBackground = noticeTone === 'accepted'
    ? 'linear-gradient(180deg, rgba(63, 52, 32, 0.34) 0%, rgba(17, 20, 27, 0.94) 100%)'
    : noticeTone === 'rejected'
      ? 'linear-gradient(180deg, rgba(106, 52, 52, 0.26) 0%, rgba(17, 20, 27, 0.94) 100%)'
      : 'linear-gradient(180deg, rgba(18, 22, 28, 0.84) 0%, rgba(10, 12, 16, 0.88) 100%)'

  const handlePrimaryAction = React.useCallback(() => {
    if (state.primaryAction.disabled || !state.primaryAction.onClick) {
      return
    }

    void sound.arm()
    state.primaryAction.onClick()
  }, [sound, state])

  const handleSelectOption = React.useCallback((id: string) => {
    void sound.arm()
    sound.playCue('cardSelect')
    state.onSelectOption?.(id)
  }, [sound, state])

  return (
    <div
      style={{
        ...background,
        minHeight: '100vh',
        padding: '42px 28px 36px',
      }}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 24 }}>
        <div
          style={{
            borderRadius: 28,
            background: 'linear-gradient(180deg, rgba(17, 20, 27, 0.82) 0%, rgba(11, 13, 17, 0.74) 100%)',
            padding: '18px 22px',
            boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 18px 40px rgba(0, 0, 0, 0.22)',
          }}
        >
          <ChapterRail
            article={state.rail.article}
            chapter={state.rail.chapter}
            label={state.rail.label}
            onBack={state.onBack}
            onMeta={state.onMeta}
            title={state.title}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 0.92fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <div
              style={{
                borderRadius: 28,
                padding: '24px 26px',
                background: 'linear-gradient(180deg, rgba(18, 22, 28, 0.84) 0%, rgba(10, 12, 16, 0.88) 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 18px 40px rgba(0, 0, 0, 0.20)',
              }}
            >
              <div
                style={{
                  fontFamily: serifFontFamily,
                  fontSize: 10,
                  lineHeight: 1.2,
                  letterSpacing: '0.26em',
                  textTransform: 'uppercase',
                  color: 'rgba(214, 179, 108, 0.80)',
                  fontWeight: 500,
                }}
              >
                {state.introEyebrow}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: serifFontFamily,
                  fontSize: 24,
                  lineHeight: 1.45,
                  fontStyle: 'italic',
                  color: 'rgba(236, 228, 208, 0.84)',
                  maxWidth: 620,
                }}
              >
                {state.initialPrompt}
              </div>
            </div>

            <SpecimenPair left={state.left} right={state.right} />
            <EvidenceDigest
              contradicts={state.counts.contradicts}
              satisfies={state.counts.satisfies}
            />

            {state.notice ? (
              <div
                style={{
                  borderRadius: 28,
                  padding: '22px 24px',
                  background: noticeBackground,
                  boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 18px 40px rgba(0, 0, 0, 0.20)',
                }}
              >
                <div
                  style={{
                    fontFamily: serifFontFamily,
                    fontSize: 10,
                    lineHeight: 1.2,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'rgba(214, 179, 108, 0.82)',
                    marginBottom: 10,
                    fontWeight: 500,
                  }}
                >
                  {state.notice.label}
                </div>
                <div
                  style={{
                    fontFamily: serifFontFamily,
                    fontSize: 18,
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                    color: 'rgba(236, 228, 208, 0.76)',
                    maxWidth: 680,
                  }}
                >
                  {state.notice.body}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 18, position: 'sticky', top: 96 }}>
            <RuleChoiceSurface
              footer={state.footer}
              onSelect={state.onSelectOption ? handleSelectOption : undefined}
              options={state.options}
              selectedId={state.selectedOptionId}
            />

            <div
              style={{
                borderRadius: 24,
                padding: '18px 18px 16px',
                background: 'linear-gradient(180deg, rgba(22, 25, 31, 0.92) 0%, rgba(12, 14, 18, 0.96) 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 16px 32px rgba(0, 0, 0, 0.2)',
                display: 'grid',
                gap: 14,
              }}
            >
              <div
                style={{
                  fontFamily: serifFontFamily,
                  fontSize: 10,
                  lineHeight: 1.2,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(214, 179, 108, 0.82)',
                  fontWeight: 500,
                }}
              >
                בחירת חוק
              </div>
              <PremiumButton
                block
                label={state.primaryAction.label}
                onClick={handlePrimaryAction}
                state={state.primaryAction.disabled ? 'disabled' : 'idle'}
              />
              <MicroActionRow actions={state.actions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
