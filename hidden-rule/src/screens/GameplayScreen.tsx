import * as React from 'react'

import { AppShell } from '../app/AppShell'
import { useGameSound, useGameplaySoundEffects } from '../audio'
import { PremiumButton, PrimaryButton } from '../components/buttons'
import {
  ChapterRail,
  FocusCardStage,
  HandPanel,
  LedgerPanel,
  MicroActionRow,
  PromptBanner,
  RuleRegister,
  VerdictBand,
} from '../components/gameplay'
import { GAMEPLAY_STATES, type GameplayVariant } from './gameplayData'
import type { GameplayViewModel } from './viewModels'

function createStaticGameplayViewModel(variant: GameplayVariant): GameplayViewModel {
  const state = GAMEPLAY_STATES[variant]

  return {
    actions: state.actions,
    contradicts: state.contradicts,
    dimHand: variant === 'ready-to-name',
    focusCard: {
      ...state.hand[Math.max(0, state.selectedIndex)],
      helper: 'הקלף הפעיל מוצג כאן בגודל קריא יותר.',
      state: state.verdict?.result === 'accepted'
        ? 'accepted'
        : state.verdict?.result === 'rejected'
          ? 'rejected'
          : state.selectedIndex >= 0
            ? 'selected'
            : 'neutral',
    },
    hand: state.hand,
    notice: variant === 'ready-to-name'
      ? {
        body: 'יש כבר מספיק רמזים. עכשיו אפשר לעצור, לנשום, וללכת על ניחוש חד.',
        label: 'חלון הזדמנות',
        tone: 'accepted',
      }
      : undefined,
    primaryAction: {
      disabled: variant === 'idle',
      label: state.primaryLabel,
      variant: state.primaryVariant,
    },
    prompt: state.prompt,
    rail: {
      article: '04',
      chapter: 'III',
      label: 'רמז',
    },
    registerLit: state.registerLit,
    registerResolved: state.registerResolved,
    registerStatus: state.registerStatus,
    registerTotal: 6,
    remainingCount: state.remainingCount,
    satisfies: state.satisfies,
    selectedIndex: state.selectedIndex,
    title: state.title,
    verdict: state.verdict,
  }
}

export function GameplayScreen({
  variant = 'idle',
  viewModel,
}: {
  variant?: GameplayVariant
  viewModel?: GameplayViewModel
}) {
  const state = viewModel ?? createStaticGameplayViewModel(variant)
  const sound = useGameSound()
  useGameplaySoundEffects(state)
  const noticeTone = state.notice?.tone ?? 'neutral'
  const noticeBackground = noticeTone === 'accepted'
    ? 'linear-gradient(180deg, rgba(63, 52, 32, 0.34) 0%, rgba(17, 20, 27, 0.94) 100%)'
    : noticeTone === 'rejected'
      ? 'linear-gradient(180deg, rgba(106, 52, 52, 0.26) 0%, rgba(17, 20, 27, 0.94) 100%)'
      : 'linear-gradient(180deg, rgba(35, 42, 51, 0.72) 0%, rgba(16, 20, 26, 0.92) 100%)'

  const handleSelectCard = React.useCallback((index: number) => {
    void sound.arm()
    sound.playCue('cardSelect')
    state.onSelectCard?.(index)
  }, [sound, state])

  const handlePrimaryAction = React.useCallback(() => {
    if (state.primaryAction.disabled || !state.primaryAction.onClick) {
      return
    }

    void sound.arm()
    if (state.primaryAction.variant === 'primary') {
      sound.playCue('cardTest')
    }
    state.primaryAction.onClick()
  }, [sound, state])

  return (
    <AppShell
      screenToneId="gameplay"
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
      <PromptBanner>{state.prompt}</PromptBanner>

      {state.focusCard ? (
        <FocusCardStage card={state.focusCard} />
      ) : null}

      <HandPanel
        cards={state.hand}
        count={state.remainingCount}
        dim={state.dimHand}
        onSelectCard={state.onSelectCard ? handleSelectCard : undefined}
        selectedIndex={state.selectedIndex}
      />

      {state.verdict ? (
        <VerdictBand
          catalog={state.verdict.catalog}
          glyph={state.verdict.glyph}
          motionKey={state.motion?.verdictKey}
          result={state.verdict.result}
        />
      ) : null}

      <LedgerPanel contradicts={state.contradicts} motionKey={state.motion?.ledgerKey} satisfies={state.satisfies} />

      <RuleRegister
        lit={state.registerLit}
        readyMotionKey={state.motion?.readyKey}
        resolved={state.registerResolved}
        status={state.registerStatus}
        total={state.registerTotal}
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
        {state.primaryAction.variant === 'premium' ? (
          <PremiumButton
            block
            label={state.primaryAction.label}
            onClick={handlePrimaryAction}
            state={state.primaryAction.disabled ? 'disabled' : 'idle'}
          />
        ) : (
          <PrimaryButton
            block
            label={state.primaryAction.label}
            onClick={handlePrimaryAction}
            state={state.primaryAction.disabled ? 'disabled' : 'idle'}
          />
        )}
        <MicroActionRow actions={state.actions} />
      </div>
    </AppShell>
  )
}
