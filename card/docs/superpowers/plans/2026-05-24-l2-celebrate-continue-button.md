# L2 Celebrate "בוא נמשיך" Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2,600ms auto-advance on the L2 celebrate step with an explicit orange "בוא נמשיך" button that the learner taps to continue.

**Architecture:** Three additive changes to `InteractiveTutorialScreen.tsx` only — (1) a boolean state variable, (2) a guard in the existing celebrate-phase effect that sets the state instead of auto-advancing, (3) a button JSX block identical in style to the existing "תראה לי" button. No other lessons are affected.

**Tech Stack:** TypeScript, React Native

---

## Task 1: Add state, effect guard, and button JSX

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx:958` (state declaration, after `l4ShowMePending`)
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx:3849` (celebrate-phase effect guard)
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx:6280` (button JSX, after the "תראה לי" block)

- [ ] **Step 1: Add the state variable**

  In `InteractiveTutorialScreen.tsx`, find line 958:
  ```ts
  const [l4ShowMePending, setL4ShowMePending] = useState(false);
  ```
  Add immediately after it:
  ```ts
  const [l2CelebratePending, setL2CelebratePending] = useState(false);
  ```

- [ ] **Step 2: Add the guard in the celebrate-phase effect**

  Find the block starting at line ~3849 (inside the `useEffect` that checks `engine.phase !== 'celebrate'`):
  ```ts
  // Lesson 4 step 3 ends with a blocking success modal; the learner moves
  // on only after explicitly acknowledging it.
  if (engine.lessonIndex === 3 && engine.stepIndex === 3) return;
  ```
  Add immediately **before** that block:
  ```ts
  // L2 (tap-card): show explicit "בוא נמשיך" button instead of auto-advancing.
  if (engine.lessonIndex === 1) {
    setL2CelebratePending(true);
    return () => setL2CelebratePending(false);
  }
  ```

- [ ] **Step 3: Add the button JSX**

  Find line ~6280 (the closing `)}` of the "תראה לי" block):
  ```tsx
      )}

      {isL7Step1Await && !l7Step1MiniPicked ? (
  ```
  Insert between those two lines:
  ```tsx
      {/* "בוא נמשיך" button — L2 celebrate only */}
      {l2CelebratePending && engine.phase === 'celebrate' && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setL2CelebratePending(false);
            dispatchEngine({ type: 'CELEBRATE_DONE' });
          }}
          accessibilityRole="button"
          style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9210 }}
        >
          <View style={{
            backgroundColor: '#F59E0B',
            borderRadius: 20,
            minHeight: 62,
            paddingVertical: 15,
            paddingHorizontal: 42,
            borderWidth: 2,
            borderColor: '#FCD34D',
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
              ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
              android: { elevation: 12 },
            }),
          }}>
            <Text style={{ color: '#431407', fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', writingDirection: 'rtl', includeFontPadding: false }}>
              בוא נמשיך
            </Text>
          </View>
        </TouchableOpacity>
      )}

  ```

- [ ] **Step 4: Verify TypeScript**

  ```
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "InteractiveTutorialScreen"
  ```
  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add src/tutorial/InteractiveTutorialScreen.tsx
  git commit -m "feat: L2 celebrate — 'בוא נמשיך' button replaces auto-advance"
  ```

---

## Self-Review

| Spec requirement | Covered |
|---|---|
| Orange "בוא נמשיך" button on L2 celebrate step | Task 1 step 3 |
| Same style as "תראה לי" button | Task 1 step 3 — identical styling copied exactly |
| Tap advances tutorial (`CELEBRATE_DONE`) | Task 1 step 3 — `onPress` dispatches `CELEBRATE_DONE` |
| No auto-advance (no timeout) | Task 1 step 2 — guard returns early, sets state instead |
| No other lessons affected | Guard is `lessonIndex === 1` only |

No placeholders. No type inconsistencies (all types match existing codebase patterns).
