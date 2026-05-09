# Tutorial Back Button — Layer + Step Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-level GO_BACK with two-level back: one press = go back one phase (שכבה), reaching intro = go back one step (שלב); button always visible, disabled only at lesson 0 step 0 intro.

**Architecture:** Add `GO_BACK_LAYER` action to the pure MimicEngine reducer (celebrate→await-mimic, await-mimic→bot-demo, bot-demo→intro). Update the back button handler in InteractiveTutorialScreen to dispatch GO_BACK_LAYER for all non-intro phases, GO_BACK only from intro. Add a useEffect for bot-demo re-entry resets. Fix L4 same-lesson dice bug.

**Tech Stack:** React Native, TypeScript, Jest (tests in `.test.ts` files alongside source)

---

### Task 1: Add `GO_BACK_LAYER` to MimicEngine

**Files:**
- Modify: `src/tutorial/MimicEngine.ts`
- Test: `src/tutorial/MimicEngine.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/tutorial/MimicEngine.test.ts` after the existing `GO_BACK` describe block:

```typescript
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

  it('intro → GO_BACK step logic (stepIndex > 0)', () => {
    // GO_BACK_LAYER from intro falls through to GO_BACK behavior
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

  it('non-navigable phases (lesson-done etc.) are ignored', () => {
    const s = mimicReducer(at('lesson-done', 0, 0), { type: 'GO_BACK_LAYER' }, LESSONS);
    expect(s).toEqual(at('lesson-done', 0, 0)); // no change
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd card && npx jest src/tutorial/MimicEngine.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — "GO_BACK_LAYER" is not a valid action type.

- [ ] **Step 3: Add `GO_BACK_LAYER` to MimicAction union**

In `src/tutorial/MimicEngine.ts`, change:

```typescript
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
  | { type: 'EXIT' };
```

to:

```typescript
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
```

- [ ] **Step 4: Add GO_BACK_LAYER reducer logic**

In `src/tutorial/MimicEngine.ts`, add immediately after `if (action.type === 'EXIT') return INITIAL_MIMIC_STATE;`:

```typescript
  if (action.type === 'GO_BACK_LAYER') {
    // Phase-level back: celebrate → await-mimic → bot-demo → intro.
    // From intro, falls through to the same step-level logic as GO_BACK.
    if (state.phase === 'celebrate') return { ...state, phase: 'await-mimic' };
    if (state.phase === 'await-mimic') return { ...state, phase: 'bot-demo' };
    if (state.phase === 'bot-demo') return { ...state, phase: 'intro' };
    // From intro: behave identically to GO_BACK (step/lesson decrement).
    if (state.phase === 'intro') {
      if (state.phase === 'post-signs-choice' || state.phase === 'core-complete') {
        const last = lessons[MIMIC_LAST_CORE_LESSON_INDEX];
        const lastStep = last ? Math.max(0, last.stepCount - 1) : 0;
        return { phase: 'intro', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: lastStep };
      }
      if (state.stepIndex > 0) {
        return { ...state, phase: 'intro', stepIndex: state.stepIndex - 1 };
      }
      if (state.lessonIndex === MIMIC_FIRST_FRACTION_LESSON_INDEX) {
        return { phase: 'post-signs-choice', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: 0 };
      }
      if (state.lessonIndex > 0) {
        const prev = lessons[state.lessonIndex - 1];
        const lastStepOfPrev = prev ? Math.max(0, prev.stepCount - 1) : 0;
        return { phase: 'intro', lessonIndex: state.lessonIndex - 1, stepIndex: lastStepOfPrev };
      }
      // lesson 0 step 0 intro — nowhere to go (disabled state).
      return state;
    }
    // All other phases (lesson-done, all-done, etc.) — no-op.
    return state;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd card && npx jest src/tutorial/MimicEngine.test.ts --no-coverage 2>&1 | tail -20
```

Expected: All GO_BACK_LAYER tests PASS, all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
cd card && git add src/tutorial/MimicEngine.ts src/tutorial/MimicEngine.test.ts
git commit -m "feat: add GO_BACK_LAYER action to MimicEngine for phase-level back navigation"
```

---

### Task 2: Add bot-demo re-entry reset useEffect

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

When the user presses back from `await-mimic` → `bot-demo`, certain lesson-specific state must be reset so the bot demo plays cleanly.

- [ ] **Step 1: Find the intro cleanup useEffect**

It starts at line ~871:
```typescript
useEffect(() => {
  if (engine.phase !== 'intro') return;
  // ... all resets ...
}, [engine.phase, engine.lessonIndex, engine.stepIndex, gameState?.phase, gameDispatch]);
```

- [ ] **Step 2: Add bot-demo re-entry reset useEffect directly after that block**

Add the following new useEffect immediately after the intro cleanup effect:

```typescript
  // ── Bot-demo re-entry reset: fires when entering bot-demo via GO_BACK_LAYER
  //    (await-mimic → bot-demo). Resets per-layer state so the demo replays
  //    cleanly. Fires on every bot-demo entry (forward AND back), which is safe
  //    because all resets below are idempotent. ──
  useEffect(() => {
    if (engine.phase !== 'bot-demo') return;
    // Reset L4b dice pulse so it doesn't linger if user backed mid-step.
    tutorialBus.setL4bDicePulse(false);
    // Reset L4 step 3 sub-phase so the guided-full-build bubble restarts.
    setL4Step3Phase('build');
    // Reset equation builder to a clean state.
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    // If the game was left in 'solved' by the learner, revert to building
    // so the equation builder is interactive when bot-demo starts.
    if (gameState?.phase === 'solved') {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
    }
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, gameState?.phase, gameDispatch]);
```

- [ ] **Step 3: Fix L4 dice bug — reset dice on same-lesson back within lesson 3**

Find the existing dice reset in the intro cleanup effect (around line 913):

```typescript
    if (engine.lessonIndex <= 2) {
      l4DiceRef.current = rollL4Dice();
    }
```

Change to:

```typescript
    if (engine.lessonIndex <= 3) {
      l4DiceRef.current = rollL4Dice();
    }
```

This ensures L4 dice are re-rolled when going back within lesson 3 (equation), not just when going back past it.

- [ ] **Step 4: Commit**

```bash
cd card && git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "fix: add bot-demo re-entry reset and fix L4 dice stale state on back-nav"
```

---

### Task 3: Update back button handler + disabled state

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

- [ ] **Step 1: Locate the back button onPress (line ~3621)**

The button currently ends with `dispatchEngine({ type: 'GO_BACK' })` as the default case. Replace the entire `onPress` handler with:

```typescript
onPress={() => {
  if (showWelcomeBubble) return;
  // Special case: advanced module started from welcome → restart.
  if (
    advancedStartedFromWelcomeRef.current &&
    engine.lessonIndex === MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.stepIndex === 0
  ) {
    advancedStartedFromWelcomeRef.current = false;
    dispatchEngine({ type: 'EXIT' });
    dispatchEngine({ type: 'START' });
    setShowWelcomeBubble(true);
    return;
  }
  // L8 step 1 (identical card mockup): back to step 0 mockup.
  if (
    engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
    engine.stepIndex === 1
  ) {
    setIdenticalMockupApproved(false);
    setIdenticalMockupPendingAdvance(false);
    l8Step1RiggedRef.current = false;
    dispatchEngine({ type: 'GO_BACK' });
    dispatchEngine({ type: 'DISMISS_INTRO' });
    return;
  }
  // L9: go back one sub-stage at a time; at stage 0 fall through to GO_BACK_LAYER.
  if (isL9Lesson && engine.phase === 'await-mimic' && l9Stage > 0) {
    if (l9Stage === 2) {
      setL9Stage(1);
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
    } else {
      setL9Stage(0);
      tutorialBus.setL6CopyConfig(null);
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    }
    return;
  }
  // L11 step 1: reset rigging refs before back.
  if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 1) {
    l8Step3RiggedRef.current = false;
    l11RiggedRef.current = false;
    l11AwaitRiggedRef.current = false;
    dispatchEngine({ type: 'GO_BACK_LAYER' });
    return;
  }
  // L11 step 0: reset rigging refs before back.
  if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 0) {
    l11RiggedRef.current = false;
    l11AwaitRiggedRef.current = false;
    dispatchEngine({ type: 'GO_BACK_LAYER' });
    return;
  }
  // Default: phase-level back (GO_BACK_LAYER handles intro→step fallthrough).
  dispatchEngine({ type: 'GO_BACK_LAYER' });
}}
```

Note: The key change is replacing every `dispatchEngine({ type: 'GO_BACK' })` in the default path with `GO_BACK_LAYER`. The special cases that previously called both `GO_BACK` + `DISMISS_INTRO` now use `GO_BACK_LAYER` (which goes to intro) and drop the `DISMISS_INTRO` call — the user sees the intro screen and can dismiss it themselves, which is correct.

**Exception — L8 step 1:** This special case keeps `GO_BACK` + `DISMISS_INTRO` because it deliberately skips the intro to show the mockup directly. Leave this case unchanged.

- [ ] **Step 2: Add disabled state to back button**

Find the button's `style` prop (around line 3680) and add a `disabled` prop:

```typescript
<TouchableOpacity
  onPress={...}
  disabled={
    engine.lessonIndex === 0 &&
    engine.stepIndex === 0 &&
    engine.phase === 'intro'
  }
  style={[
    {
      paddingVertical: 8,
      paddingHorizontal: 12,
      minWidth: 82,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(71,85,105,0.92)',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: 'rgba(148,163,184,0.7)',
    },
    engine.lessonIndex === 0 &&
    engine.stepIndex === 0 &&
    engine.phase === 'intro' &&
    { opacity: 0.35 },
  ]}
>
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd card && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "GO_BACK_LAYER|InteractiveTutorial|MimicEngine" | head -20
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
cd card && git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat: back button uses GO_BACK_LAYER for phase-level navigation, disabled at start"
```

---

### Task 4: Manual verification checklist

No automated tests cover InteractiveTutorialScreen directly (it's a complex React Native screen). Use the dev server to verify manually.

- [ ] **Step 1: Start the app**

```bash
cd card && npx expo start --web
```

Open in browser at `http://localhost:8081`.

- [ ] **Step 2: Verify disabled state**

Start tutorial → first screen (lesson 0, step 0, intro). Back button should appear with **opacity 0.35** and not respond to clicks.

- [ ] **Step 3: Verify 3-press back within one step**

Advance through: dismiss intro → watch bot demo → (await-mimic phase).
- Press back once → should see bot demo replay (phase: bot-demo)
- Press back again → should see intro screen (phase: intro)
- Press back again → still on intro, lesson 0, step 0 → button disabled

- [ ] **Step 4: Verify back crosses steps**

On lesson 3, step 2 (did-you-know) intro → press back → lands on step 1 (fill-missing-die) intro.
On step 1 intro → press back → lands on step 0 (play-card) intro.
On step 0 intro → press back → lands on lesson 2 last step intro.

- [ ] **Step 5: Verify celebrate → await-mimic**

Complete a step (reach celebrate). Press back → should return to await-mimic (the user's turn).

- [ ] **Step 6: Verify L4 step 3 (full-build) back from await-mimic**

Advance to lesson 3 (equation), step 3 (full-build), await-mimic. Build equation partially.
Press back → should see bot-demo. Bubble should show `botFull` text, l4Step3Phase reset to 'build'.

- [ ] **Step 7: Verify L4b (fill-missing-die) dice pulse stops on back**

On lesson 3, step 1, await-mimic → dice should pulse. Press back → pulse stops (bot-demo).

- [ ] **Step 8: Commit final verification note**

```bash
cd card && git commit --allow-empty -m "chore: manual verification complete for tutorial back-button layer nav"
```
