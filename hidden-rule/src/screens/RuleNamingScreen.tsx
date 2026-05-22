import * as React from 'react'

import { AppShell } from '../app/AppShell'
import { useGameSound, useNamingSoundEffects } from '../audio'
import { PremiumButton } from '../components/buttons'
import {
  ChapterRail,
  EvidenceDigest,
  MicroActionRow,
  RuleChoiceSurface,
  SpecimenPair,
} from '../components/gameplay'
import type { RuleNamingViewModel } from './viewModels'

function createStaticRuleNamingViewModel(): RuleNamingViewModel {
  return {
    actions: [
      { label: 'חזור למשחק' },
      { label: 'קח רמז' },
    ],
    counts: {
      contradicts: 3,
      satisfies: 4,
    },
    footer: 'בחירה / פתוחה',
    initialPrompt: <>יש מספיק ראיות. עכשיו בחר את החוק שמתאים לקלפים שעברו את הבדיקה.</>,
    introEyebrow: 'פרק III / רשומה 04',
    left: { catalog: 'II-03', glyph: 'ladder-rungs' },
    motion: {
      entryKey: 'static-naming-entry',
    },
    onSelectOption: undefined,
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
}

export function RuleNamingScreen({
  viewModel,
}: {
  viewModel?: RuleNamingViewModel
}) {
  const state = viewModel ?? createStaticRuleNamingViewModel()
  const sound = useGameSound()
  useNamingSoundEffects(state)
  const noticeTone = state.notice?.tone ?? 'neutral'
  const noticeBackground = noticeTone === 'accepted'
    ? 'linear-gradient(180deg, rgba(63, 52, 32, 0.34) 0%, rgba(17, 20, 27, 0.94) 100%)'
    : noticeTone === 'rejected'
      ? 'linear-gradient(180deg, rgba(106, 52, 52, 0.26) 0%, rgba(17, 20, 27, 0.94) 100%)'
      : 'linear-gradient(180deg, rgba(35, 42, 51, 0.72) 0%, rgba(16, 20, 26, 0.92) 100%)'

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
    <AppShell
      screenToneId="rulesMeta"
      topBar={(
        <ChapterRail
          article={state.rail.article}
          chapter={state.rail.chapter}
          label={state.rail.label}
          onBack={state.onBack}
          onMeta={state.onMeta}
          title={state.title}
        />
      )}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: '"Frank Ruhl Libre", Georgia, serif',
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
              marginTop: 8,
              fontFamily: '"Frank Ruhl Libre", Georgia, serif',
              fontSize: 18,
              lineHeight: 1.45,
              fontStyle: 'italic',
              color: 'rgba(236, 228, 208, 0.84)',
            }}
          >
            {state.initialPrompt}
          </div>
        </div>

        <SpecimenPair
          left={state.left}
          right={state.right}
        />

        <EvidenceDigest
          contradicts={state.counts.contradicts}
          satisfies={state.counts.satisfies}
        />

        <RuleChoiceSurface
          footer={state.footer}
          onSelect={state.onSelectOption ? handleSelectOption : undefined}
          options={state.options}
          selectedId={state.selectedOptionId}
        />

        {state.notice ? (
          <div
            style={{
              borderRadius: 18,
              padding: '14px 16px',
              background: noticeBackground,
              boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 10px 24px rgba(6, 8, 12, 0.16)',
            }}
          >
            <div
              style={{
                fontFamily: '"Frank Ruhl Libre", Georgia, serif',
                fontSize: 10,
                lineHeight: 1.2,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(214, 179, 108, 0.80)',
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              {state.notice.label}
            </div>
            <div
              style={{
                fontFamily: '"Frank Ruhl Libre", Georgia, serif',
                fontSize: 14,
                lineHeight: 1.55,
                fontStyle: 'italic',
                color: 'rgba(236, 228, 208, 0.76)',
              }}
            >
              {state.notice.body}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 14, marginTop: 'auto' }}>
          <PremiumButton
            block
            label={state.primaryAction.label}
            onClick={handlePrimaryAction}
            state={state.primaryAction.disabled ? 'disabled' : 'idle'}
          />
          <MicroActionRow actions={state.actions} />
        </div>
      </div>
    </AppShell>
  )
}
