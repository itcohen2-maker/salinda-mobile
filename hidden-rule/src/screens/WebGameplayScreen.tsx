import * as React from 'react'

import { createBackgroundStyle } from '../app/backgroundStyle'
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
import {
  buildBackgroundRecipe,
  DEFAULT_BACKGROUND_PRESET_ID,
  FONT_STACKS,
} from '../theme'
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
    notice: {
      body: 'בפורמט הרחב רואים טוב יותר את היומן, את היד ואת קצב הפיצוח, בלי להזיז את הקלפים מהמרכז.',
      label: 'שולחן המשחק',
      tone: 'neutral',
    },
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

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

export function WebGameplayScreen({
  variant = 'idle',
  viewModel,
}: {
  variant?: GameplayVariant
  viewModel?: GameplayViewModel
}) {
  const state = viewModel ?? createStaticGameplayViewModel(variant)
  const sound = useGameSound()
  useGameplaySoundEffects(state)
  const background = React.useMemo(
    () => createBackgroundStyle(buildBackgroundRecipe(DEFAULT_BACKGROUND_PRESET_ID, 'gameplay')),
    [],
  )
  const noticeTone = state.notice?.tone ?? 'neutral'
  const noticeBackground = noticeTone === 'accepted'
    ? 'linear-gradient(180deg, rgba(63, 52, 32, 0.34) 0%, rgba(17, 20, 27, 0.94) 100%)'
    : noticeTone === 'rejected'
      ? 'linear-gradient(180deg, rgba(106, 52, 52, 0.26) 0%, rgba(17, 20, 27, 0.94) 100%)'
      : 'linear-gradient(180deg, rgba(17, 20, 27, 0.76) 0%, rgba(9, 11, 15, 0.84) 100%)'

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
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 18 }}>
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
            {state.notice ? (
              <div
                style={{
                  borderRadius: 28,
                  padding: '22px 24px',
                  background: noticeBackground,
                  boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 18px 36px rgba(0, 0, 0, 0.18)',
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
            <LedgerPanel contradicts={state.contradicts} motionKey={state.motion?.ledgerKey} satisfies={state.satisfies} />
            <RuleRegister
              lit={state.registerLit}
              readyMotionKey={state.motion?.readyKey}
              resolved={state.registerResolved}
              status={state.registerStatus}
              total={state.registerTotal}
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
                פעולות הסיבוב
              </div>
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
          </div>
        </div>
      </div>
    </div>
  )
}
