// ============================================================
// MimicEngine.ts — Watch-and-mimic tutorial state machine
// Pure reducer. UI side effects (bot demo, outcome detection,
// celebrate timer) are dispatched as actions from the outside.
// ============================================================

export type MimicPhase =
  | 'idle'
  | 'intro'
  | 'bot-demo'
  | 'await-mimic'
  | 'celebrate'
  | 'lesson-done'
  | 'core-complete'
  | 'post-signs-choice'
  | 'advanced-complete'
  | 'all-done';

export type MimicState = {
  phase: MimicPhase;
  lessonIndex: number;
  stepIndex: number;
};

export type MimicAction =
  | { type: 'START' }
  | { type: 'DISMISS_INTRO' }
  | { type: 'BOT_DEMO_DONE' }
  | { type: 'OUTCOME_MATCHED' }
  | { type: 'CELEBRATE_DONE' }
  | { type: 'DISMISS_LESSON_DONE' }
  | { type: 'DISMISS_CORE_COMPLETE' }
  | { type: 'DISMISS_ADVANCED_COMPLETE' }
  | { type: 'CHOOSE_FINISH_TUTORIAL' }
  | { type: 'CHOOSE_ADVANCED_FRACTIONS' }
  | { type: 'JUMP_TO_ADVANCED' }
  | { type: 'GO_BACK' }
  | { type: 'GO_BACK_LAYER' }
  | { type: 'EXIT' };

/** Last core lesson index (0-based) before optional fractions branch.
 *  Core lessons: 0 fan, 1 tap, 2 dice, 3 equation, 4 op-cycle+joker,
 *  5 possible-results (chip + mini-cards + wild-card handoff). */
export const MIMIC_LAST_CORE_LESSON_INDEX = 5;

/** First optional fractions module lesson index (append after core lessons). */
export const MIMIC_FIRST_FRACTION_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 1;

/** Parens-move lesson index — follows fractions in the advanced sequence. */
export const MIMIC_PARENS_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 2;

/** Single identical-card play lesson index (lesson-09) — follows parens. */
export const MIMIC_SINGLE_IDENTICAL_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 3;

/** Multi-play tip lesson index (lesson-10). */
export const MIMIC_MULTI_PLAY_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 4;

/** Legacy mini-copy lesson index (removed from active advanced flow). */
export const MIMIC_IDENTICAL_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 5;

export type LessonShape = { id: string; stepCount: number };

export const INITIAL_MIMIC_STATE: MimicState = {
  phase: 'idle',
  lessonIndex: 0,
  stepIndex: 0,
};

const POSSIBLE_RESULTS_LESSON_ID = 'possible-results-basics';

function isPossibleResultsLesson(state: MimicState, lessons: LessonShape[]): boolean {
  return lessons[state.lessonIndex]?.id === POSSIBLE_RESULTS_LESSON_ID;
}

function getPreviousStepIndex(state: MimicState, lessons: LessonShape[]): number {
  // L6 step 1 (tap-mini) stays in the registry for compatibility, but the
  // active tutorial flow skips it. Back navigation must skip it too.
  if (isPossibleResultsLesson(state, lessons) && state.stepIndex === 2) return 0;
  return state.stepIndex - 1;
}

export function mimicReducer(
  state: MimicState,
  action: MimicAction,
  lessons: LessonShape[],
): MimicState {
  if (action.type === 'EXIT') return INITIAL_MIMIC_STATE;

  if (action.type === 'GO_BACK_LAYER') {
    if (
      isPossibleResultsLesson(state, lessons) &&
      state.stepIndex === 2 &&
      (
        state.phase === 'intro' ||
        state.phase === 'bot-demo' ||
        state.phase === 'await-mimic' ||
        state.phase === 'celebrate'
      )
    ) {
      return { ...state, phase: 'intro', stepIndex: 0 };
    }
    // celebrate → await-mimic: "layer back" — lets the learner retry without
    // losing the current step. All other phases use step-level back logic.
    if (state.phase === 'celebrate') return { ...state, phase: 'await-mimic' };
    // bot-demo → intro: bot-demo auto-runs so we can't stay there; bring the
    // learner to the intro screen where they can re-read and re-trigger the demo.
    if (state.phase === 'bot-demo') return { ...state, phase: 'intro' };
    // await-mimic + intro: step-level back (same logic as GO_BACK).
    if (state.phase === 'await-mimic' || state.phase === 'intro') {
      if (state.stepIndex > 0) {
        return { ...state, phase: 'intro', stepIndex: getPreviousStepIndex(state, lessons) };
      }
      if (state.lessonIndex === MIMIC_FIRST_FRACTION_LESSON_INDEX) {
        return { phase: 'post-signs-choice', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: 0 };
      }
      if (state.lessonIndex > 0) {
        const prev = lessons[state.lessonIndex - 1];
        const lastStepOfPrev = prev ? Math.max(0, prev.stepCount - 1) : 0;
        return { phase: 'intro', lessonIndex: state.lessonIndex - 1, stepIndex: lastStepOfPrev };
      }
      return state; // lesson 0 step 0 → no-op (disabled)
    }
    return state; // lesson-done, all-done etc → no-op
  }

  if (action.type === 'GO_BACK') {
    if (
      isPossibleResultsLesson(state, lessons) &&
      state.stepIndex === 2 &&
      (
        state.phase === 'intro' ||
        state.phase === 'bot-demo' ||
        state.phase === 'await-mimic' ||
        state.phase === 'celebrate' ||
        state.phase === 'lesson-done'
      )
    ) {
      return { ...state, phase: 'intro', stepIndex: 0 };
    }
    if (state.phase === 'post-signs-choice' || state.phase === 'core-complete') {
      const last = lessons[MIMIC_LAST_CORE_LESSON_INDEX];
      const lastStep = last ? Math.max(0, last.stepCount - 1) : 0;
      return { phase: 'intro', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: lastStep };
    }

    // await-mimic, bot-demo, and intro all use the same "go back one step" logic.
    // This makes ONE press go back a full step/lesson regardless of sub-phase.
    if (
      state.phase === 'await-mimic' ||
      state.phase === 'bot-demo' ||
      state.phase === 'intro'
    ) {
      // Go back one step within the current lesson.
      if (state.stepIndex > 0) {
        return { ...state, phase: 'intro', stepIndex: getPreviousStepIndex(state, lessons) };
      }

      // Step 0: go back to the previous lesson's LAST step.
      // Exception: first advanced lesson goes to post-signs-choice.
      if (state.lessonIndex === MIMIC_FIRST_FRACTION_LESSON_INDEX) {
        return { phase: 'post-signs-choice', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: 0 };
      }
      if (state.lessonIndex > 0) {
        const prev = lessons[state.lessonIndex - 1];
        const lastStepOfPrev = prev ? Math.max(0, prev.stepCount - 1) : 0;
        return { phase: 'intro', lessonIndex: state.lessonIndex - 1, stepIndex: lastStepOfPrev };
      }
      return { phase: 'intro', lessonIndex: 0, stepIndex: 0 };
    }

    // If the user already reached celebration for the current step,
    // one "back" returns to that step's mimic phase.
    if (state.phase === 'celebrate') {
      return { ...state, phase: 'await-mimic' };
    }

    // If lesson-done/completion screens are open, back to the lesson intro.
    if (
      state.phase === 'lesson-done' ||
      state.phase === 'advanced-complete' ||
      state.phase === 'all-done'
    ) {
      return { ...state, phase: 'intro' };
    }
  }

  if (action.type === 'CHOOSE_FINISH_TUTORIAL' && state.phase === 'post-signs-choice') {
    return { ...state, phase: 'all-done' };
  }

  if (action.type === 'CHOOSE_ADVANCED_FRACTIONS' &&
      (state.phase === 'post-signs-choice' || state.phase === 'core-complete')) {
    return { phase: 'intro', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX + 1, stepIndex: 0 };
  }

  // Jump to the fractions-advanced lesson from any phase (tutorial skip button).
  if (action.type === 'JUMP_TO_ADVANCED') {
    return { phase: 'intro', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX + 1, stepIndex: 0 };
  }

  if (action.type === 'START') {
    if (lessons.length === 0) return { ...state, phase: 'all-done' };
    return { phase: 'intro', lessonIndex: 0, stepIndex: 0 };
  }

  if (action.type === 'DISMISS_INTRO' && state.phase === 'intro') {
    return { ...state, phase: 'bot-demo' };
  }

  if (action.type === 'BOT_DEMO_DONE' && state.phase === 'bot-demo') {
    return { ...state, phase: 'await-mimic' };
  }

  if (action.type === 'OUTCOME_MATCHED' && state.phase === 'await-mimic') {
    const lesson = lessons[state.lessonIndex];
    const isLastStep = state.stepIndex >= ((lesson?.stepCount ?? 1) - 1);
    if (state.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && isLastStep) {
      return { ...state, phase: 'advanced-complete' };
    }
    return { ...state, phase: 'celebrate' };
  }

  if (action.type === 'CELEBRATE_DONE' && state.phase === 'celebrate') {
    const lesson = lessons[state.lessonIndex];
    const isLastStep = state.stepIndex >= lesson.stepCount - 1;
    if (isLastStep) {
      return { ...state, phase: 'lesson-done' };
    }
    if (lesson?.id === POSSIBLE_RESULTS_LESSON_ID && state.stepIndex === 0 && lesson.stepCount > 2) {
      return { ...state, phase: 'intro', stepIndex: 2 };
    }
    if (lesson?.id === POSSIBLE_RESULTS_LESSON_ID && state.stepIndex === 1) {
      return { ...state, phase: 'intro', stepIndex: 2 };
    }
    return { ...state, phase: 'bot-demo', stepIndex: state.stepIndex + 1 };
  }

  if (action.type === 'DISMISS_LESSON_DONE' && state.phase === 'lesson-done') {
    const atCoreEnd =
      state.lessonIndex === MIMIC_LAST_CORE_LESSON_INDEX &&
      lessons[MIMIC_LAST_CORE_LESSON_INDEX]?.id === POSSIBLE_RESULTS_LESSON_ID;
    if (atCoreEnd) {
      return { ...state, phase: 'core-complete' };
    }
    // Multi-play is now the final advanced lesson — show the advanced completion screen.
    if (state.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX) {
      return { ...state, phase: 'advanced-complete' };
    }
    const isLastLesson = state.lessonIndex >= lessons.length - 1;
    if (isLastLesson) {
      return { ...state, phase: 'all-done' };
    }
    return { phase: 'intro', lessonIndex: state.lessonIndex + 1, stepIndex: 0 };
  }

  if (action.type === 'DISMISS_CORE_COMPLETE' && state.phase === 'core-complete') {
    return { ...state, phase: 'post-signs-choice' };
  }

  if (action.type === 'DISMISS_ADVANCED_COMPLETE' && state.phase === 'advanced-complete') {
    return { ...state, phase: 'all-done' };
  }

  return state;
}
