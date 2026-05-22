import * as React from 'react'

export type CardGlyphId =
  | 'paired-bars'
  | 'cut-diamond'
  | 'ring-axis'
  | 'triple-notch'
  | 'tally-seal'
  | 'ladder-rungs'
  | 'nested-arc'

export type PrototypeCard = {
  accepted: boolean
  catalog: string
  glyph: CardGlyphId
  id: string
}

export type RuleOption = {
  id: string
  isCorrect: boolean
  label: string
}

export type ChapterDefinition = {
  articleCode: string
  brief: string
  chapterCode: string
  completionLine: string
  correctRuleExplanation: string
  deck: readonly PrototypeCard[]
  goalLine: string
  hints: readonly string[]
  idlePrompt: string
  incorrectGuessHint: string
  introEyebrow: string
  readyThreshold: number
  ruleOptions: readonly RuleOption[]
  successHeading: string
  title: string
}

type Verdict = {
  card: PrototypeCard
  result: 'accepted' | 'rejected'
}

type Submission = {
  correct: boolean
  heading: string
  message: string
  tone: 'accepted' | 'rejected'
}

type GameScreen = 'chapter-complete' | 'chapter-intro' | 'gameplay' | 'rule-choice'

type GameState = {
  chapterIndex: number
  continueInvestigating: boolean
  contradicts: PrototypeCard[]
  hand: PrototypeCard[]
  hintLevel: number
  queue: PrototypeCard[]
  satisfies: PrototypeCard[]
  screen: GameScreen
  selectedCardId: null | string
  selectedRuleId: null | string
  submission: null | Submission
  verdict: null | Verdict
}

const chapters: readonly ChapterDefinition[] = [
  {
    articleCode: '04',
    brief: 'בפרק הזה החוק מסתתר בתוך המבנה של הסמל עצמו. חפש מה משותף לקלפים שעוברים את הבדיקה.',
    chapterCode: 'III',
    completionLine: 'פיצחת את החוק של הפרק הראשון. בפרק הבא הדפוס מתחלף לגמרי.',
    correctRuleExplanation:
      'נכון. כל קלף שמתאים לחוק נשען על פס אופקי במרכז הסמל. הקלפים שלא מתאימים שוברים את הקו הזה.',
    deck: [
      { accepted: true, catalog: 'II-11', glyph: 'paired-bars', id: 'chapter-1-card-01' },
      { accepted: false, catalog: 'III-04', glyph: 'cut-diamond', id: 'chapter-1-card-02' },
      { accepted: true, catalog: 'III-09', glyph: 'ring-axis', id: 'chapter-1-card-03' },
      { accepted: true, catalog: 'II-17', glyph: 'triple-notch', id: 'chapter-1-card-04' },
      { accepted: false, catalog: 'IV-02', glyph: 'tally-seal', id: 'chapter-1-card-05' },
      { accepted: true, catalog: 'II-03', glyph: 'ladder-rungs', id: 'chapter-1-card-06' },
      { accepted: false, catalog: 'III-11', glyph: 'nested-arc', id: 'chapter-1-card-07' },
      { accepted: false, catalog: 'II-06', glyph: 'cut-diamond', id: 'chapter-1-card-08' },
    ],
    goalLine: 'אסוף לפחות 4 ראיות, עם דוגמאות שעוברות וגם דוגמאות שנפסלות, ואז בחר את החוק.',
    hints: [
      'עזוב את מספרי הקטלוג. החוק יושב בתוך הסמל עצמו.',
      'חפש פס אופקי ברור שחוצה את מרכז הסמל.',
    ],
    idlePrompt: 'יש חוק נסתר. בחר קלף והתחל לחקור.',
    incorrectGuessHint:
      'לא זה. הסתכל שוב על הקלפים שמתאימים לחוק: בכולם יש פס אופקי ברור באזור המרכז.',
    introEyebrow: 'פרק III / רשומה 04',
    readyThreshold: 4,
    ruleOptions: [
      {
        id: 'chapter-1-rule-center-bar',
        isCorrect: true,
        label: 'הקלף מתאים לחוק רק אם יש פס אופקי ברור במרכז הסמל.',
      },
      {
        id: 'chapter-1-rule-double-mark',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם יש שני סימנים זהים זה מול זה.',
      },
      {
        id: 'chapter-1-rule-open-form',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם הסמל פתוח ואינו נסגר לצורה מלאה.',
      },
    ],
    successHeading: 'פיצחת!',
    title: 'הסדר ההדדי',
  },
  {
    articleCode: '07',
    brief: 'כאן לא מחפשים קו אחד. צריך להבין מי מהסמלים נסגר לצורה שלמה ומי נשאר פתוח.',
    chapterCode: 'IV',
    completionLine: 'גם זה נפתח. כרגע זה סוף הדמו, אבל כבר יש רצף אמיתי בין פרקים.',
    correctRuleExplanation:
      'בול. כל קלף שמתאים לחוק סוגר את הסמל בתוך מסגרת, טבעת או צורה מקיפה. הקלפים שלא מתאימים נשארים פתוחים.',
    deck: [
      { accepted: true, catalog: 'IV-11', glyph: 'ring-axis', id: 'chapter-2-card-01' },
      { accepted: false, catalog: 'IV-13', glyph: 'paired-bars', id: 'chapter-2-card-02' },
      { accepted: true, catalog: 'IV-17', glyph: 'nested-arc', id: 'chapter-2-card-03' },
      { accepted: false, catalog: 'V-02', glyph: 'ladder-rungs', id: 'chapter-2-card-04' },
      { accepted: true, catalog: 'V-06', glyph: 'triple-notch', id: 'chapter-2-card-05' },
      { accepted: true, catalog: 'V-08', glyph: 'tally-seal', id: 'chapter-2-card-06' },
      { accepted: true, catalog: 'V-10', glyph: 'cut-diamond', id: 'chapter-2-card-07' },
      { accepted: false, catalog: 'V-14', glyph: 'paired-bars', id: 'chapter-2-card-08' },
    ],
    goalLine: 'אסוף שוב 4 ראיות לפחות, ואז בחר איזו הגדרה באמת מסבירה את הקלפים שעברו.',
    hints: [
      'הפעם לא צריך לחפש קו אחד. תסתכל אם הסמל סגור או נשאר פתוח.',
      'הקלפים שמתאימים לחוק כולם תחומים בתוך מסגרת, טבעת או צורה שסוגרת אותם.',
    ],
    idlePrompt: 'חוק חדש. הפעם השאלה היא מי סגור ומי נשאר פתוח.',
    incorrectGuessHint:
      'כמעט. החוק כאן קשור לסמל שנסגר בתוך מסגרת או טבעת, לא רק לסידור הפנימי שלו.',
    introEyebrow: 'פרק IV / רשומה 07',
    readyThreshold: 4,
    ruleOptions: [
      {
        id: 'chapter-2-rule-enclosed',
        isCorrect: true,
        label: 'הקלף מתאים לחוק רק אם הסמל סגור בתוך מסגרת, טבעת או צורה מקיפה.',
      },
      {
        id: 'chapter-2-rule-horizontal',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם יש פס אופקי ברור במרכז הסמל.',
      },
      {
        id: 'chapter-2-rule-three-cuts',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם יש שלוש קטיעות קטנות לאורך הצדדים.',
      },
    ],
    successHeading: 'סגרת גם את זה!',
    title: 'חותם הסגירה',
  },
] as const

function canChooseRuleFromCounts(
  readyThreshold: number,
  satisfiesCount: number,
  contradictsCount: number,
) {
  return (
    satisfiesCount + contradictsCount >= readyThreshold &&
    satisfiesCount >= 2 &&
    contradictsCount >= 2
  )
}

function getChapter(chapterIndex: number) {
  return chapters[chapterIndex] ?? chapters[0]
}

function createInitialState(chapterIndex = 0): GameState {
  const chapter = getChapter(chapterIndex)

  return {
    chapterIndex,
    continueInvestigating: false,
    contradicts: [],
    hand: chapter.deck.slice(0, 3),
    hintLevel: 0,
    queue: chapter.deck.slice(3),
    satisfies: [],
    screen: 'chapter-intro',
    selectedCardId: null,
    selectedRuleId: null,
    submission: null,
    verdict: null,
  }
}

export function usePrototypeGame() {
  const [state, setState] = React.useState<GameState>(() => createInitialState())

  const currentChapter = getChapter(state.chapterIndex)
  const evidenceCount = state.satisfies.length + state.contradicts.length
  const canChooseRule = canChooseRuleFromCounts(
    currentChapter.readyThreshold,
    state.satisfies.length,
    state.contradicts.length,
  )
  const readyMode =
    state.screen === 'gameplay' && canChooseRule && !state.continueInvestigating
  const hasNextChapter = state.chapterIndex < chapters.length - 1
  const nextChapter = hasNextChapter ? getChapter(state.chapterIndex + 1) : null

  const selectedCard = state.selectedCardId
    ? state.hand.find((card) => card.id === state.selectedCardId) ?? null
    : null

  const currentHint =
    state.hintLevel > 0
      ? currentChapter.hints[
          Math.min(state.hintLevel - 1, currentChapter.hints.length - 1)
        ]
      : null

  let phaseLabel = 'פתיחת פרק'
  if (state.screen === 'gameplay') {
    phaseLabel = readyMode
      ? 'מוכן לבחירת חוק'
      : state.verdict
        ? 'אחרי בדיקה'
        : 'חקירה'
  } else if (state.screen === 'rule-choice') {
    phaseLabel = 'בחירת חוק'
  } else if (state.screen === 'chapter-complete') {
    phaseLabel = 'חוק ננעל'
  }

  let gameplayPrompt = currentChapter.idlePrompt
  if (readyMode) {
    gameplayPrompt = 'נאספו מספיק ראיות. אפשר לעצור ולבחור את החוק.'
  } else if (state.verdict) {
    gameplayPrompt =
      state.verdict.result === 'accepted'
        ? 'הקלף שנבדק מתאים לחוק.'
        : 'הקלף שנבדק לא מתאים לחוק.'
  } else if (selectedCard) {
    gameplayPrompt = 'הקלף שבחרת מוכן לבדיקה.'
  }

  let gameplayNotice: null | {
    body: string
    label: string
    tone: 'accepted' | 'neutral' | 'rejected'
  } = null

  if (currentHint) {
    gameplayNotice = {
      body: currentHint,
      label: 'רמז',
      tone: 'neutral',
    }
  } else if (!state.verdict && evidenceCount === 0 && !selectedCard) {
    gameplayNotice = {
      body: 'בחר קלף אחד מהיד, בדוק אותו, וצבור ראיות בשני הצדדים: מה מתאים לחוק ומה נפסל.',
      label: 'איך משחקים',
      tone: 'neutral',
    }
  } else if (!state.verdict && selectedCard) {
    gameplayNotice = {
      body: 'השלב הבא הוא לבדוק את הקלף שבחרת. התוצאה תירשם מיד ביומן הפיצוח.',
      label: 'המהלך הבא',
      tone: 'neutral',
    }
  } else if (readyMode) {
    gameplayNotice = {
      body: 'כבר יש מספיק ראיות. עכשיו צריך לבחור איזו הגדרה באמת מסבירה את מה שראית.',
      label: 'מוכן לבחירה',
      tone: 'accepted',
    }
  }

  const focusCard = state.verdict?.card ?? selectedCard ?? state.hand[0] ?? null
  let focusState: 'accepted' | 'neutral' | 'rejected' | 'selected' = 'neutral'
  let focusHelper = 'בחר קלף כדי לראות את הסמל בגודל גדול וברור יותר.'

  if (state.verdict) {
    focusState = state.verdict.result
    focusHelper =
      state.verdict.result === 'accepted'
        ? 'הקלף הזה עבר את הבדיקה ומחזק את הכיוון שלך.'
        : 'הקלף הזה נפסל. זה רמז חשוב לא פחות מקלף שעבר.'
  } else if (selectedCard) {
    focusState = 'selected'
    focusHelper = 'זה הקלף שבחרת. אם הוא נראה לך משמעותי, בדוק אותו.'
  }

  const defaultAccepted =
    state.satisfies[0] ??
    currentChapter.deck.find((card) => card.accepted) ??
    currentChapter.deck[0]
  const defaultRejected =
    state.contradicts[0] ??
    currentChapter.deck.find((card) => !card.accepted) ??
    currentChapter.deck[1]

  let choiceNotice: null | {
    body: string
    label: string
    tone: 'accepted' | 'neutral' | 'rejected'
  } = null

  if (state.submission) {
    choiceNotice = {
      body: state.submission.message,
      label: state.submission.heading,
      tone: state.submission.tone,
    }
  } else if (currentHint) {
    choiceNotice = {
      body: currentHint,
      label: 'רמז',
      tone: 'neutral',
    }
  } else {
    choiceNotice = {
      body: 'אל תחפש ניסוח יפה. רק בחר את החוק שהכי מדויק לפי הדוגמאות שעברו והדוגמאות שנפסלו.',
      label: 'עכשיו מכריעים',
      tone: 'neutral',
    }
  }

  function startChapter() {
    setState((current) => ({
      ...current,
      screen: 'gameplay',
    }))
  }

  function restartAll() {
    setState(createInitialState(0))
  }

  function restartChapter() {
    setState((current) => createInitialState(current.chapterIndex))
  }

  function advanceChapter() {
    setState((current) => {
      const nextIndex = current.chapterIndex + 1
      return nextIndex < chapters.length
        ? createInitialState(nextIndex)
        : createInitialState(0)
    })
  }

  function selectCard(index: number) {
    setState((current) => {
      if (current.screen !== 'gameplay' || current.submission?.correct) {
        return current
      }

      const chapter = getChapter(current.chapterIndex)
      const chapterReady = canChooseRuleFromCounts(
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
  }

  function testSelectedCard() {
    setState((current) => {
      if (
        current.screen !== 'gameplay' ||
        !current.selectedCardId ||
        current.submission?.correct
      ) {
        return current
      }

      const chapter = getChapter(current.chapterIndex)
      const chapterReady = canChooseRuleFromCounts(
        chapter.readyThreshold,
        current.satisfies.length,
        current.contradicts.length,
      )

      if (chapterReady && !current.continueInvestigating) {
        return current
      }

      const selectedIndex = current.hand.findIndex(
        (card) => card.id === current.selectedCardId,
      )
      if (selectedIndex === -1) {
        return current
      }

      const testedCard = current.hand[selectedIndex]
      const nextQueue = [...current.queue]
      const replacement = nextQueue.shift()
      const nextHand = current.hand.filter((card) => card.id !== testedCard.id)

      if (replacement) {
        nextHand.splice(selectedIndex, 0, replacement)
      }

      return {
        ...current,
        continueInvestigating: false,
        contradicts: testedCard.accepted
          ? current.contradicts
          : [{ ...testedCard }, ...current.contradicts].slice(0, 6),
        hand: nextHand,
        queue: nextQueue,
        satisfies: testedCard.accepted
          ? [{ ...testedCard }, ...current.satisfies].slice(0, 6)
          : current.satisfies,
        selectedCardId: null,
        submission: null,
        verdict: {
          card: testedCard,
          result: testedCard.accepted ? 'accepted' : 'rejected',
        },
      }
    })
  }

  function requestHint() {
    setState((current) => ({
      ...current,
      hintLevel: Math.min(current.hintLevel + 1, currentChapter.hints.length),
    }))
  }

  function continueInvestigating() {
    setState((current) => ({
      ...current,
      continueInvestigating: true,
      screen: 'gameplay',
      submission: current.submission?.correct ? current.submission : null,
      verdict: null,
    }))
  }

  function openRuleChoice() {
    setState((current) => {
      const chapter = getChapter(current.chapterIndex)
      const canOpen = canChooseRuleFromCounts(
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
        screen: 'rule-choice',
        selectedRuleId: current.submission?.correct ? current.selectedRuleId : null,
        verdict: null,
      }
    })
  }

  function selectRuleOption(id: string) {
    setState((current) => ({
      ...current,
      selectedRuleId: id,
      submission: null,
    }))
  }

  function submitRuleChoice() {
    setState((current) => {
      const option = currentChapter.ruleOptions.find(
        (rule) => rule.id === current.selectedRuleId,
      )
      if (!option) {
        return current
      }

      if (option.isCorrect) {
        return {
          ...current,
          screen: 'chapter-complete' as const,
          submission: {
            correct: true,
            heading: currentChapter.successHeading,
            message: `${currentChapter.correctRuleExplanation} ${currentChapter.completionLine}`,
            tone: 'accepted',
          },
        }
      }

      return {
        ...current,
        submission: {
          correct: false,
          heading: 'לא זה',
          message: currentChapter.incorrectGuessHint,
          tone: 'rejected',
        },
      }
    })
  }

  return {
    actions: {
      advanceChapter,
      continueInvestigating,
      openRuleChoice,
      requestHint,
      restartAll,
      restartChapter,
      selectCard,
      selectRuleOption,
      startChapter,
      submitRuleChoice,
      testSelectedCard,
    },
    chapterComplete: {
      hasNextChapter,
      message:
        state.submission?.message ??
        `${currentChapter.correctRuleExplanation} ${currentChapter.completionLine}`,
      nextLabel: hasNextChapter && nextChapter
        ? `לפרק הבא: ${nextChapter.title}`
        : 'שחק שוב מההתחלה',
      title: state.submission?.heading ?? currentChapter.successHeading,
      witnessAccepted: defaultAccepted,
      witnessRejected: defaultRejected,
    },
    chapterCount: chapters.length,
    chapterIndex: state.chapterIndex,
    chapterIntro: {
      brief: currentChapter.brief,
      goalLine: currentChapter.goalLine,
      startLabel: 'התחל פרק',
      title: currentChapter.title,
      witnessCard: currentChapter.deck[0],
    },
    currentChapter,
    gameplay: {
      canChooseRule,
      contradicts: state.contradicts,
      focusCard,
      focusHelper,
      focusState,
      hand: state.hand,
      notice: gameplayNotice,
      primaryDisabled: readyMode ? false : !selectedCard,
      primaryLabel: readyMode
        ? 'לבחירת החוק'
        : selectedCard
          ? 'בדוק את הקלף'
          : 'בחר קלף לבדיקה',
      prompt: gameplayPrompt,
      readyMode,
      registerCurrent: Math.min(currentChapter.readyThreshold, evidenceCount),
      registerTarget: currentChapter.readyThreshold,
      registerStatus: readyMode
        ? 'אפשר כבר להכריע'
        : evidenceCount === 0
          ? 'עדיין אין ראיות'
          : `${Math.min(currentChapter.readyThreshold, evidenceCount)} מתוך ${currentChapter.readyThreshold} ראיות נאספו`,
      remainingCount: state.queue.length,
      selectedCard,
      selectedIndex: selectedCard
        ? state.hand.findIndex((card) => card.id === selectedCard.id)
        : -1,
      satisfies: state.satisfies,
      title: currentChapter.title,
      verdict: state.verdict,
    },
    phaseLabel,
    ruleChoice: {
      counts: {
        contradicts: state.contradicts.length,
        satisfies: state.satisfies.length,
      },
      footer: 'בחר חוק אחד והתחייב אליו',
      hasNextChapter,
      notice: choiceNotice,
      options: currentChapter.ruleOptions.map((option) => ({
        ...option,
        selected: option.id === state.selectedRuleId,
      })),
      primaryDisabled: !state.selectedRuleId,
      primaryLabel: 'אשר את הבחירה',
      prompt: 'יש מספיק ראיות. עכשיו בחר את ההסבר שמחזיק מול כל מה שכבר נבדק.',
      selectedOptionId: state.selectedRuleId,
      submission: state.submission,
      title: 'מה החוק כאן?',
      witnessAccepted: defaultAccepted,
      witnessRejected: defaultRejected,
    },
    screen: state.screen,
  }
}
