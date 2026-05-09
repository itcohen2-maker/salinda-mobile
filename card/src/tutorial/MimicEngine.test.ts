import {
  type MimicState,
  type LessonShape,
  INITIAL_MIMIC_STATE,
  mimicReducer,
  MIMIC_FIRST_FRACTION_LESSON_INDEX,
  MIMIC_LAST_CORE_LESSON_INDEX,
} from './MimicEngine';

const LESSONS: LessonShape[] = [
  { id: 'fan-basics', stepCount: 2 },
  { id: 'dice', stepCount: 1 },
];

const after = (state: MimicState, ...actions: Parameters<typeof mimicReducer>[1][]): MimicState =>
  actions.reduce((s, a) => mimicReducer(s, a, LESSONS), state);

describe('MimicEngine — initial state', () => {
  it('starts idle at lesson 0 step 0', () => {
    expect(INITIAL_MIMIC_STATE).toEqual({
      phase: 'idle',
      lessonIndex: 0,
      stepIndex: 0,
    });
  });
});

describe('MimicEngine — happy path single lesson, single step', () => {
  it('START moves idle → intro on lesson 0', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' });
    expect(s.phase).toBe('intro');
    expect(s.lessonIndex).toBe(0);
    expect(s.stepIndex).toBe(0);
  });

  it('DISMISS_INTRO moves intro → bot-demo on step 0', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'DISMISS_INTRO' });
    expect(s.phase).toBe('bot-demo');
    expect(s.stepIndex).toBe(0);
  });

  it('BOT_DEMO_DONE moves bot-demo → await-mimic', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
    );
    expect(s.phase).toBe('await-mimic');
  });

  it('OUTCOME_MATCHED moves await-mimic → celebrate', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
      { type: 'OUTCOME_MATCHED' },
    );
    expect(s.phase).toBe('celebrate');
  });
});

describe('MimicEngine — step advance within a lesson', () => {
  it('CELEBRATE_DONE on step 0 of 2-step lesson moves to bot-demo on step 1', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
      { type: 'OUTCOME_MATCHED' },
      { type: 'CELEBRATE_DONE' },
    );
    expect(s.phase).toBe('bot-demo');
    expect(s.stepIndex).toBe(1);
    expect(s.lessonIndex).toBe(0);
  });

  it('CELEBRATE_DONE on last step of lesson moves to lesson-done', () => {
    const walkOneStep = (s: MimicState): MimicState =>
      after(s, { type: 'BOT_DEMO_DONE' }, { type: 'OUTCOME_MATCHED' }, { type: 'CELEBRATE_DONE' });

    let s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'DISMISS_INTRO' });
    s = walkOneStep(s); // finishes step 0 → bot-demo step 1
    s = walkOneStep(s); // finishes step 1 → lesson-done

    expect(s.phase).toBe('lesson-done');
    expect(s.lessonIndex).toBe(0);
  });
});

describe('MimicEngine — lesson advance', () => {
  const finishLessonZero = (): MimicState => {
    const walkOneStep = (s: MimicState): MimicState =>
      after(s, { type: 'BOT_DEMO_DONE' }, { type: 'OUTCOME_MATCHED' }, { type: 'CELEBRATE_DONE' });
    let s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'DISMISS_INTRO' });
    s = walkOneStep(s);
    s = walkOneStep(s);
    return s;
  };

  it('DISMISS_LESSON_DONE with more lessons → intro on next lesson, step 0', () => {
    const s = after(finishLessonZero(), { type: 'DISMISS_LESSON_DONE' });
    expect(s.phase).toBe('intro');
    expect(s.lessonIndex).toBe(1);
    expect(s.stepIndex).toBe(0);
  });

  it('DISMISS_LESSON_DONE on last lesson → all-done', () => {
    const finishLessonOne = (): MimicState => {
      let s = after(finishLessonZero(), { type: 'DISMISS_LESSON_DONE' });
      s = after(s, { type: 'DISMISS_INTRO' });
      s = after(s, { type: 'BOT_DEMO_DONE' }, { type: 'OUTCOME_MATCHED' }, { type: 'CELEBRATE_DONE' });
      return s;
    };
    const s = after(finishLessonOne(), { type: 'DISMISS_LESSON_DONE' });
    expect(s.phase).toBe('all-done');
  });
});

describe('MimicEngine — exit & defensive transitions', () => {
  it('EXIT from any phase returns to idle and resets indices', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
      { type: 'EXIT' },
    );
    expect(s).toEqual(INITIAL_MIMIC_STATE);
  });

  it('OUTCOME_MATCHED in wrong phase is a no-op', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'OUTCOME_MATCHED' });
    expect(s.phase).toBe('intro');
  });

  it('BOT_DEMO_DONE in wrong phase is a no-op', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'BOT_DEMO_DONE' });
    expect(s.phase).toBe('intro');
  });

  it('DISMISS_INTRO from idle is a no-op', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'DISMISS_INTRO' });
    expect(s.phase).toBe('idle');
  });
});

describe('MimicEngine — empty lessons edge case', () => {
  it('START with empty lessons array → all-done immediately', () => {
    const s = mimicReducer(INITIAL_MIMIC_STATE, { type: 'START' }, []);
    expect(s.phase).toBe('all-done');
  });
});

describe('MimicEngine — GO_BACK_LAYER', () => {
  const at = (phase: MimicState['phase'], lessonIndex = 0, stepIndex = 0): MimicState =>
    ({ phase, lessonIndex, stepIndex });

  it('celebrate → await-mimic (same lesson/step)', () => {
    const s = mimicReducer(at('celebrate', 0, 1), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual({ phase: 'await-mimic', lessonIndex: 0, stepIndex: 1 });
  });

  it('await-mimic → bot-demo (same lesson/step)', () => {
    const s = mimicReducer(at('await-mimic', 1, 0), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual({ phase: 'bot-demo', lessonIndex: 1, stepIndex: 0 });
  });

  it('bot-demo → intro (same lesson/step)', () => {
    const s = mimicReducer(at('bot-demo', 0, 1), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual({ phase: 'intro', lessonIndex: 0, stepIndex: 1 });
  });

  it('intro step > 0 → decrements step', () => {
    const s = mimicReducer(at('intro', 0, 1), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual({ phase: 'intro', lessonIndex: 0, stepIndex: 0 });
  });

  it('intro step 0 lesson 0 → stays (disabled case)', () => {
    const s = mimicReducer(at('intro', 0, 0), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual({ phase: 'intro', lessonIndex: 0, stepIndex: 0 });
  });

  it('intro step 0 lesson > 0 → previous lesson last step', () => {
    // LESSONS[0] = fan-basics, stepCount: 2 → lastStep = 1
    const s = mimicReducer(at('intro', 1, 0), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual({ phase: 'intro', lessonIndex: 0, stepIndex: 1 });
  });

  it('intro step 0 at MIMIC_FIRST_FRACTION_LESSON_INDEX → post-signs-choice', () => {
    const s = mimicReducer(
      { phase: 'intro', lessonIndex: MIMIC_FIRST_FRACTION_LESSON_INDEX, stepIndex: 0 },
      { type: 'GO_BACK_LAYER' },
      LESSONS,
    );
    expect(s).toEqual({ phase: 'post-signs-choice', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: 0 });
  });

  it('lesson-done and other non-navigable phases → no-op', () => {
    const s = mimicReducer(at('lesson-done', 0, 0), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual(at('lesson-done', 0, 0));
  });
});
