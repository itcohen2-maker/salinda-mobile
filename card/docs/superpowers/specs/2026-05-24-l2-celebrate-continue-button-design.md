# L2 Celebrate — "בוא נמשיך" Continue Button

**Date:** 2026-05-24

## Problem

After the learner taps a card in L2, a pink celebrate bubble appears ("מעולה! ככה בוחרים קלף..."). The tutorial currently auto-advances after 2,600ms. There is no visible affordance telling the learner that they need to wait or act — it feels abrupt.

## Goal

Add an explicit orange "בוא נמשיך" button at the bottom of the screen during the L2 celebrate phase. The learner taps it to advance. No auto-advance.

## Scope

L2 (lessonIndex=1) celebrate step only. No other lessons or steps are affected.

## Design

### State

Add one boolean state variable near the existing `l4ShowMePending`:

```ts
const [l2CelebratePending, setL2CelebratePending] = useState(false);
```

### Celebrate-phase effect guard (InteractiveTutorialScreen.tsx ~line 3848)

In the `useEffect` that fires when `engine.phase === 'celebrate'`, add a guard before the default timeout block:

```ts
// L2 (tap-card): show explicit "בוא נמשיך" button instead of auto-advancing.
if (engine.lessonIndex === 1) {
  setL2CelebratePending(true);
  return () => setL2CelebratePending(false);
}
```

This replaces the 2,600ms timeout for L2 with a manual gate.

### Button JSX

Placed near the existing "תראה לי" button block (around line 6252). Identical styling: orange `#F59E0B`, `bottom: 60`, `zIndex: 9210`.

```tsx
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
      paddingVertical: 15,
      paddingHorizontal: 48,
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

## Files Changed

- `src/tutorial/InteractiveTutorialScreen.tsx` — state declaration, celebrate-effect guard, button JSX

## What Does Not Change

- All other lessons' celebrate behavior is untouched
- The celebrate bubble itself (pink bubble, copy, positioning) is untouched
- No new i18n keys — the button label is hardcoded Hebrew (consistent with "תראה לי")
