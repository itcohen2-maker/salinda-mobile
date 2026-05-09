# Tutorial Back Button — Layer + Step Navigation

**Date:** 2026-05-09
**Status:** Approved

---

## Goal

Replace the current single-level GO_BACK (always jumps a full step) with a two-level back:
- **Level 1 (שכבה/layer):** go back one phase within the same step
- **Level 2 (שלב/step):** go back a full step (triggered when already at the first layer)

Single button. Disabled (not hidden) when there is nowhere to go.

---

## Phase Hierarchy Per Step

```
intro → bot-demo → await-mimic → celebrate
```

Each press of "חזור" moves one level back in this hierarchy.

---

## Back Transition Table

| Current Phase | Condition | Result |
|---|---|---|
| `celebrate` | any | → `await-mimic` |
| `await-mimic` | any | → `bot-demo` + layer reset |
| `bot-demo` | any | → `intro` + rigging reset |
| `intro` | stepIndex > 0 | → intro of stepIndex - 1 (existing GO_BACK logic) |
| `intro` | stepIndex === 0, lessonIndex > 0 | → intro of last step of lessonIndex - 1 |
| `intro` | stepIndex === 0, lessonIndex === 0 | → disabled (no-op) |

Special cases that preserve their own back logic (no change):
- `post-signs-choice` / `core-complete` → existing jump to L5 step 2
- `lesson-done` / `advanced-complete` / `all-done` → existing return to intro
- L9 await-mimic stage > 0 → decrement stage first; at stage 0 → bot-demo

---

## Disabled State

```
lessonIndex === 0 && stepIndex === 0 && phase === 'intro'
```

Button always rendered. When disabled: `opacity: 0.35`, `disabled={true}`.

---

## Engine Changes (MimicEngine.ts)

Add two new action types:

### `GO_BACK_LAYER`
Handles celebrate → await-mimic, await-mimic → bot-demo, bot-demo → intro.
Does NOT change lessonIndex or stepIndex.

```
celebrate    → { ...state, phase: 'await-mimic' }
await-mimic  → { ...state, phase: 'bot-demo' }
bot-demo     → { ...state, phase: 'intro' }
```

### `GO_BACK` (existing, unchanged)
Only called from `intro` phase. Existing step/lesson decrement logic stays as-is.

---

## InteractiveTutorialScreen Changes

### Back button onPress logic

```
if (phase === 'intro') {
  dispatchEngine({ type: 'GO_BACK' });   // existing behavior
} else {
  // L9 special case: handle sub-stages before going to bot-demo
  if (isL9Lesson && phase === 'await-mimic' && l9Stage > 0) {
    // existing L9 stage decrement logic
    return;
  }
  dispatchEngine({ type: 'GO_BACK_LAYER' });
}
```

### Layer resets (via useEffect on phase)

**On transition to `bot-demo`** (when coming from await-mimic):
- `tutorialBus.emitFanDemo({ kind: 'eqReset' })`
- `tutorialBus.setL4bDicePulse(false)`
- `setL4Step3Phase('build')`
- `gameDispatch({ type: 'REVERT_TO_BUILDING' })` if game phase is `'solved'`

**On transition to `intro`** (when coming from bot-demo):
- All existing intro-cleanup resets apply (clearCardFrame, eqReset, CLEAR_EQ_HAND, etc.)
- Reset rigging refs: `l4DiceRef`, `fracBotDemoRiggedRef`, `l7RiggedRef`, `l8Step1RiggedRef`, `l8Step3RiggedRef`, `l9RiggedRef`, `l10RiggedRef`, `l11RiggedRef`, `l11AwaitRiggedRef`, `l7Step1RiggedRef`

### Bug fix: L4 dice reset in same-lesson back
Current code only regenerates L4 dice when `lessonIndex <= 2` (i.e., going back past lesson 2).
Fix: regenerate L4 dice whenever `lessonIndex === 3` and we transition to `intro` (regardless of direction).

---

## Disabled Button Style

```tsx
disabled={lessonIndex === 0 && stepIndex === 0 && phase === 'intro'}
style={[
  existingBackStyle,
  lessonIndex === 0 && stepIndex === 0 && phase === 'intro' && { opacity: 0.35 }
]}
```

---

## What Does NOT Change

- GO_BACK step/lesson decrement logic (MimicEngine lines 84–120)
- L8 mockup back special case
- L11 step 1 special case
- post-signs-choice / core-complete special cases
- lesson-done / advanced-complete / all-done special cases
- Skip button behavior

---

## Testing Checkpoints

1. celebrate → await-mimic → bot-demo → intro (3 presses, same step)
2. From intro: back to previous step
3. From intro of lesson 0 step 0: button disabled, no state change
4. L4 step 3 (full-build): back from await-mimic resets l4Step3Phase to 'build'
5. L4b step 1: back from await-mimic stops dice pulse
6. L9: stage 2 → 1 → 0 → bot-demo → intro (5 presses total)
7. No double-rigging on re-entry to bot-demo after back
