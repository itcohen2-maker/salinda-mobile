import * as React from 'react'

import type { ArchiveCardSpec } from '../components/gameplay'
import type { GameplayVariant } from '../screens/gameplayData'
import type {
  GameplayViewModel,
  RuleNamingViewModel,
  ScreenNotice,
} from '../screens/viewModels'
import {
  canNameRuleFromCounts,
  PROTOTYPE_CHAPTERS,
  type PrototypeChapterCard,
} from './prototypeChapterDefinition'

type PrototypeSubmission = {
  correct: boolean
  heading: string
  message: string
  tone: 'accepted' | 'rejected'
}

type PrototypeState = {
  chapterIndex: number
  continueInvestigating: boolean
  contradicts: PrototypeChapterCard[]
  hand: PrototypeChapterCard[]
  hintLevel: number
  motion: {
    ledger: number
    naming: number
    ready: number
    submission: number
    verdict: number
  }
  queue: PrototypeChapterCard[]
  screen: 'gameplay' | 'rule-naming'
  selectedCardId: string | null
  selectedRuleId: string | null
  satisfies: PrototypeChapterCard[]
  submission: PrototypeSubmission | null
  verdict: null | {
    card: PrototypeChapterCard
    result: 'accepted' | 'rejected'
  }
}

function getChapter(chapterIndex: number) {
  return PROTOTYPE_CHAPTERS[chapterIndex] ?? PROTOTYPE_CHAPTERS[0]
}

function createInitialState(chapterIndex = 0): PrototypeState {
  const chapter = getChapter(chapterIndex)

  return {
    chapterIndex,
    continueInvestigating: false,
    contradicts: [],
    hand: chapter.deck.slice(0, 3),
    hintLevel: 0,
    motion: {
      ledger: 0,
      naming: 0,
      ready: 0,
      submission: 0,
      verdict: 0,
    },
    queue: chapter.deck.slice(3),
    screen: 'gameplay',
    selectedCardId: null,
    selectedRuleId: null,
    satisfies: [],
    submission: null,
    verdict: null,
  }
}

function toEvidence(card: PrototypeChapterCard): ArchiveCardSpec {
  return {
    catalog: card.catalog,
    glyph: card.glyph,
  }
}

export function usePrototypeChapter() {
  const [state, setState] = React.useState(() => createInitialState(0))

  const currentChapter = getChapter(state.chapterIndex)
  const evidenceCount = state.satisfies.length + state.contradicts.length
  const canChooseRule = canNameRuleFromCounts(
    currentChapter.readyThreshold,
    state.satisfies.length,
    state.contradicts.length,
  )
  const hasNextChapter = state.chapterIndex < PROTOTYPE_CHAPTERS.length - 1
  const nextChapter = hasNextChapter ? getChapter(state.chapterIndex + 1) : null
  const solvedCurrentChapter = state.submission?.correct ?? false

  const readyMode =
    state.screen === 'gameplay' &&
    canChooseRule &&
    !state.continueInvestigating

  const currentHint = state.hintLevel > 0
    ? currentChapter.hints[Math.min(state.hintLevel - 1, currentChapter.hints.length - 1)]
    : null

  const openRuleNaming = React.useCallback(() => {
    setState((current) => {
      const chapter = getChapter(current.chapterIndex)
      const canOpen = canNameRuleFromCounts(
        chapter.readyThreshold,
        current.satisfies.length,
        current.contradicts.length,
      )

      if (!canOpen && !current.submission?.correct) {
        return current
      }

      return {
        ...current,
        continueInvestigating: false,
        motion: {
          ...current.motion,
          naming: current.motion.naming + 1,
        },
        screen: 'rule-naming',
        selectedRuleId: current.submission?.correct ? current.selectedRuleId : null,
        verdict: null,
      }
    })
  }, [])

  const restart = React.useCallback(() => {
    setState(createInitialState(0))
  }, [])

  const restartCurrentChapter = React.useCallback(() => {
    setState((current) => createInitialState(current.chapterIndex))
  }, [])

  const advanceChapter = React.useCallback(() => {
    setState((current) => {
      const nextIndex = current.chapterIndex + 1
      return nextIndex < PROTOTYPE_CHAPTERS.length
        ? createInitialState(nextIndex)
        : createInitialState(0)
    })
  }, [])

  const selectCard = React.useCallback((index: number) => {
    setState((current) => {
      if (current.screen !== 'gameplay' || current.submission?.correct) {
        return current
      }

      const chapter = getChapter(current.chapterIndex)
      const chapterReady = canNameRuleFromCounts(
        chapter.readyThreshold,
        current.satisfies.length,
        current.contradicts.length,
      )

      if (chapterReady && !current.continueInvestigating) {
        return current
      }

      const nextCard = current.hand[index]
      if (!nextCard) {
        return current
      }

      return {
        ...current,
        selectedCardId: nextCard.id,
        submission: null,
        verdict: null,
      }
    })
  }, [])

  const requestHint = React.useCallback(() => {
    setState((current) => {
      const chapter = getChapter(current.chapterIndex)

      return {
        ...current,
        hintLevel: Math.min(current.hintLevel + 1, chapter.hints.length),
      }
    })
  }, [])

  const continueInvestigating = React.useCallback(() => {
    setState((current) => ({
      ...current,
      continueInvestigating: true,
      screen: 'gameplay',
      submission: current.submission?.correct ? current.submission : null,
      verdict: null,
    }))
  }, [])

  const testSelectedCard = React.useCallback(() => {
    setState((current) => {
      if (current.screen !== 'gameplay' || !current.selectedCardId || current.submission?.correct) {
        return current
      }

      const chapter = getChapter(current.chapterIndex)
      const wasReady = canNameRuleFromCounts(
        chapter.readyThreshold,
        current.satisfies.length,
        current.contradicts.length,
      )

      if (wasReady && !current.continueInvestigating) {
        return current
      }

      const selectedIndex = current.hand.findIndex((card) => card.id === current.selectedCardId)
      if (selectedIndex === -1) {
        return current
      }

      const selectedCard = current.hand[selectedIndex]
      const nextQueue = [...current.queue]
      const replacement = nextQueue.shift()
      const nextHand = current.hand.filter((card) => card.id !== selectedCard.id)

      if (replacement) {
        nextHand.splice(selectedIndex, 0, replacement)
      }

      const nextSatisfies = selectedCard.accepted
        ? [{ ...selectedCard }, ...current.satisfies].slice(0, 6)
        : current.satisfies

      const nextContradicts = selectedCard.accepted
        ? current.contradicts
        : [{ ...selectedCard }, ...current.contradicts].slice(0, 6)

      const nowReady = canNameRuleFromCounts(
        chapter.readyThreshold,
        nextSatisfies.length,
        nextContradicts.length,
      )

      return {
        ...current,
        continueInvestigating: false,
        contradicts: nextContradicts,
        hand: nextHand,
        motion: {
          ...current.motion,
          ledger: current.motion.ledger + 1,
          ready: !wasReady && nowReady
            ? current.motion.ready + 1
            : current.motion.ready,
          verdict: current.motion.verdict + 1,
        },
        queue: nextQueue,
        satisfies: nextSatisfies,
        selectedCardId: null,
        submission: null,
        verdict: {
          card: selectedCard,
          result: selectedCard.accepted ? 'accepted' : 'rejected',
        },
      }
    })
  }, [])

  const selectRuleOption = React.useCallback((id: string) => {
    setState((current) => ({
      ...current,
      selectedRuleId: id,
      submission: null,
    }))
  }, [])

  const submitRuleChoice = React.useCallback(() => {
    setState((current) => {
      const chapter = getChapter(current.chapterIndex)
      const selectedOption = chapter.ruleOptions.find((option) => option.id === current.selectedRuleId)
      if (!selectedOption) {
        return current
      }

      return {
        ...current,
        motion: {
          ...current.motion,
          submission: current.motion.submission + 1,
        },
        submission: selectedOption.isCorrect
          ? {
            correct: true,
            heading: chapter.successHeading,
            message: `${chapter.correctRuleExplanation} ${chapter.completionLine}`,
            tone: 'accepted',
          }
          : {
            correct: false,
            heading: 'לא זה',
            message: chapter.incorrectGuessHint,
            tone: 'rejected',
          },
      }
    })
  }, [])

  const selectedIndex = state.selectedCardId
    ? state.hand.findIndex((card) => card.id === state.selectedCardId)
    : -1

  const gameplayVariant: GameplayVariant = readyMode
    ? 'ready-to-name'
    : state.verdict
      ? 'after-check'
      : 'idle'

  const gameplayPrompt = readyMode
    ? (
      <>
        <em>יש לך מספיק ראיות.</em> עכשיו אפשר לבחור את החוק.
      </>
    )
    : state.verdict
      ? (
        <>
          <em>{state.verdict.card.catalog}</em>{' '}
          {state.verdict.result === 'accepted' ? 'מתאים לחוק.' : 'לא מתאים לחוק.'}
        </>
      )
      : state.selectedCardId
        ? (
          <>
            <em>{state.hand[selectedIndex]?.catalog}</em> מוכן לבדיקה.
          </>
        )
        : <>{currentChapter.idlePrompt}</>

  let gameplayNotice: ScreenNotice | undefined

  if (currentHint) {
    gameplayNotice = {
      body: currentHint,
      label: 'רמז',
      tone: 'neutral',
    }
  }

  if (!currentHint && !state.verdict && evidenceCount === 0 && !state.selectedCardId) {
    gameplayNotice = {
      body: 'בחר קלף מהיד ולחץ "בדוק". כל תוצאה נרשמת ביומן הפיצוח, ומשם מתחיל להתבהר החוק.',
      label: 'איך מתחילים',
      tone: 'neutral',
    }
  }

  if (!currentHint && !state.verdict && state.selectedCardId) {
    gameplayNotice = {
      body: 'השלב הבא פשוט: לחץ "בדוק". הקלף יסומן כמתאים לחוק או כלא מתאים לחוק, והיומן יתעד את זה מיד.',
      label: 'המהלך הבא',
      tone: 'neutral',
    }
  }

  if (readyMode) {
    gameplayNotice = {
      body: 'לא מקלידים כלום. עוברים למסך בחירה ובוחרים את החוק שנראה נכון לפי הראיות.',
      label: 'מוכן לבחירה',
      tone: 'accepted',
    }
  }

  const gameplayViewModel: GameplayViewModel = {
    actions: readyMode
      ? [
        { label: 'עוד סיבוב', onClick: continueInvestigating },
        { label: 'קח רמז', onClick: requestHint },
      ]
      : canChooseRule
        ? [
          { label: 'קח רמז', onClick: requestHint },
          { label: 'בחר את החוק', onClick: openRuleNaming, strong: true },
        ]
        : [
          { label: 'קח רמז', onClick: requestHint },
          { label: 'אפס את הפרק', onClick: restartCurrentChapter },
        ],
    contradicts: state.contradicts.map((card, index) => ({
      ...toEvidence(card),
      fresh: index === 0 && state.verdict?.card.id === card.id && state.verdict.result === 'rejected',
      motionKey: index === 0 && state.verdict?.card.id === card.id && state.verdict.result === 'rejected'
        ? `ledger-${state.motion.ledger}-${card.id}`
        : undefined,
    })),
    dimHand: readyMode,
    focusCard: state.verdict
      ? {
        ...toEvidence(state.verdict.card),
        helper: state.verdict.result === 'accepted'
          ? 'הקלף הזה עבר את הבדיקה ומתאים לחוק.'
          : 'הקלף הזה נבדק ולא מתאים לחוק.',
        state: state.verdict.result === 'accepted' ? 'accepted' : 'rejected',
      }
      : state.selectedCardId
        ? {
          ...toEvidence(state.hand[selectedIndex] ?? state.hand[0]),
          helper: 'כאן רואים את הסמל בגודל קריא יותר לפני הבדיקה.',
          state: 'selected',
        }
        : state.hand[0]
          ? {
            ...toEvidence(state.hand[0]),
            helper: 'בחר קלף מהיד כדי לבדוק אותו מקרוב.',
            state: 'neutral',
          }
          : undefined,
    hand: state.hand.map(toEvidence),
    motion: {
      ledgerKey: state.verdict ? `ledger-${state.motion.ledger}-${state.verdict.card.id}` : undefined,
      readyKey: state.motion.ready ? `ready-${state.motion.ready}` : undefined,
      verdictKey: state.verdict ? `verdict-${state.motion.verdict}-${state.verdict.card.id}` : undefined,
    },
    notice: gameplayNotice,
    onBack: restartCurrentChapter,
    onMeta: requestHint,
    onSelectCard: readyMode ? undefined : selectCard,
    primaryAction: readyMode
      ? {
        label: 'בחר את החוק',
        onClick: openRuleNaming,
        variant: 'premium' as const,
      }
      : {
        disabled: !state.selectedCardId,
        label: state.selectedCardId ? 'בדוק' : 'בחר קלף לבדיקה',
        onClick: state.selectedCardId ? testSelectedCard : undefined,
        variant: 'primary' as const,
      },
    prompt: gameplayPrompt,
    rail: {
      article: currentChapter.articleCode,
      chapter: currentChapter.chapterCode,
      label: 'רמז',
    },
    registerLit: Math.min(currentChapter.readyThreshold, evidenceCount),
    registerResolved: readyMode,
    registerStatus: readyMode
      ? 'מוכן / אפשר לבחור'
      : evidenceCount === 0
        ? 'ממתין לבדיקה ראשונה'
        : `מתחדד / ${Math.min(currentChapter.readyThreshold, evidenceCount)} מתוך ${currentChapter.readyThreshold}`,
    registerTotal: currentChapter.readyThreshold,
    remainingCount: state.queue.length,
    satisfies: state.satisfies.map((card, index) => ({
      ...toEvidence(card),
      fresh: index === 0 && state.verdict?.card.id === card.id && state.verdict.result === 'accepted',
      motionKey: index === 0 && state.verdict?.card.id === card.id && state.verdict.result === 'accepted'
        ? `ledger-${state.motion.ledger}-${card.id}`
        : undefined,
    })),
    selectedIndex,
    title: currentChapter.title,
    verdict: state.verdict
      ? {
        catalog: state.verdict.card.catalog,
        glyph: state.verdict.card.glyph,
        result: state.verdict.result,
      }
      : undefined,
  }

  const defaultAccepted = state.satisfies[0] ?? currentChapter.deck.find((card) => card.accepted) ?? currentChapter.deck[0]
  const defaultRejected = state.contradicts[0] ?? currentChapter.deck.find((card) => !card.accepted) ?? currentChapter.deck[1]

  let namingNotice: ScreenNotice | undefined
  if (state.submission) {
    namingNotice = {
      body: state.submission.message,
      label: state.submission.heading,
      tone: state.submission.tone,
    }
  } else if (currentHint) {
    namingNotice = {
      body: currentHint,
      label: 'רמז',
      tone: 'neutral',
    }
  } else {
    namingNotice = {
      body: 'הממשק כבר לא בודק ניסוח חופשי. פשוט בוחרים חוק אחד מתוך הרשימה ומאשרים.',
      label: 'איך זה עובד',
      tone: 'neutral',
    }
  }

  const namingViewModel: RuleNamingViewModel = {
    actions: state.submission?.correct
      ? hasNextChapter
        ? [
          { label: 'שחק שוב את הפרק', onClick: restartCurrentChapter },
        ]
        : [
          { label: 'שחק שוב את פרק הסיום', onClick: restartCurrentChapter },
        ]
      : [
        { label: 'חזור למשחק', onClick: continueInvestigating },
        { label: 'קח רמז', onClick: requestHint },
      ],
    counts: {
      contradicts: state.contradicts.length,
      satisfies: state.satisfies.length,
    },
    footer: state.submission?.correct ? 'בחירה / ננעלה' : 'בחירה / פתוחה',
    initialPrompt: state.submission?.correct
      ? (
        <>
          <em>{state.submission.heading}</em> {hasNextChapter ? 'החוק ננעל. אפשר לפתוח את הפרק הבא.' : 'החוק האחרון ננעל. אפשר להתחיל ריצה חדשה.'}
        </>
      )
      : <>יש מספיק ראיות. בחר את החוק שנשמע נכון לפי הקלפים שמתאימים לחוק והקלפים שלא מתאימים.</>,
    introEyebrow: currentChapter.introEyebrow,
    left: toEvidence(defaultAccepted),
    motion: {
      entryKey: `naming-${state.motion.naming}`,
      submissionKey: state.submission ? `submission-${state.motion.submission}` : undefined,
    },
    notice: namingNotice,
    onBack: state.submission?.correct ? undefined : continueInvestigating,
    onMeta: state.submission?.correct ? undefined : requestHint,
    onSelectOption: selectRuleOption,
    options: currentChapter.ruleOptions.map((option) => ({
      id: option.id,
      label: option.label,
      selected: option.id === state.selectedRuleId,
    })),
    primaryAction: state.submission?.correct
      ? {
        label: hasNextChapter && nextChapter ? `פתח את ${nextChapter.title}` : 'שחק שוב מההתחלה',
        onClick: hasNextChapter ? advanceChapter : restart,
      }
      : {
        disabled: !state.selectedRuleId,
        label: 'אשר את הבחירה',
        onClick: submitRuleChoice,
      },
    rail: {
      article: currentChapter.articleCode,
      chapter: currentChapter.chapterCode,
      label: 'כלל',
    },
    right: toEvidence(defaultRejected),
    selectedOptionId: state.selectedRuleId ?? undefined,
    title: solvedCurrentChapter ? `החוק ננעל / ${currentChapter.title}` : 'בחירת החוק',
  }

  return {
    chapterCount: PROTOTYPE_CHAPTERS.length,
    chapterIndex: state.chapterIndex,
    currentPhase: state.screen,
    gameplayVariant,
    gameplayViewModel,
    namingViewModel,
    openRuleNaming,
    restart,
    screen: state.screen,
  }
}
