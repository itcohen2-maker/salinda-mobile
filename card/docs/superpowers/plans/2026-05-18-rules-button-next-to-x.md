# Rules Button Next to X — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "חוקים / Rules" button directly beside the X (exit) button in the in-game HUD, same size, default blue color, opening the existing RulesContent modal.

**Architecture:** `TurnTransition` already contains the HUD column. Wrap the X button and new Rules button in a horizontal `flexDirection:'row'` View inside that column. Reuse the existing `AppModal` + `RulesContent` components, passing the live `state` (same pattern as `StartScreen`). Add one i18n key `ui.rules`.

**Tech Stack:** React Native, TypeScript, existing `SalindaButton`, `AppModal`, `RulesContent` — all in `index.tsx`.

---

## Files

| File | Change |
|---|---|
| `shared/i18n/he.ts` | Add `'ui.rules': 'חוקים'` after line 388 |
| `shared/i18n/en.ts` | Add `'ui.rules': 'Rules'` after line 384 |
| `index.tsx` | Modify `TurnTransition` (lines 13148–14811): add state, row wrapper, button, modal |

---

### Task 1 — Add `ui.rules` i18n key

**Files:**
- Modify: `shared/i18n/he.ts:388`
- Modify: `shared/i18n/en.ts:384`

- [ ] **Step 1: Add Hebrew key in `shared/i18n/he.ts`**

Insert after line 388 (`'ui.tournament': 'טורניר',`):

```ts
  'ui.rules': 'חוקים',
```

Result around that block:
```ts
  'ui.tournament': 'טורניר',
  'ui.rules': 'חוקים',
  'ui.tournamentTitle': 'טורניר — טבלת טורניר',
```

- [ ] **Step 2: Add English key in `shared/i18n/en.ts`**

Insert after line 384 (`'ui.tournament': 'Scores',`):

```ts
  'ui.rules': 'Rules',
```

Result around that block:
```ts
  'ui.tournament': 'Scores',
  'ui.rules': 'Rules',
  'ui.tournamentTitle': 'Tournament — Scoreboard',
```

- [ ] **Step 3: Verify TypeScript compiles (no missing-key errors)**

```bash
npx tsc --noEmit
```

Expected: no errors about missing i18n keys.

- [ ] **Step 4: Commit**

```bash
git add shared/i18n/he.ts shared/i18n/en.ts
git commit -m "feat: add ui.rules i18n key (he + en)"
```

---

### Task 2 — Add Rules button + modal to `TurnTransition`

**Files:**
- Modify: `index.tsx` — `TurnTransition` function (lines 13148–14811)

The three exact edits below are independent; apply all three.

---

#### Edit A — Add `rulesOpen` state

Find this line inside `TurnTransition` (near the other `useState` calls, around line 13290):

```ts
  const [tournamentInfoOpen, setTournamentInfoOpen] = useState(false);
```

Add immediately after it:

```ts
  const [rulesOpen, setRulesOpen] = useState(false);
```

---

#### Edit B — Wrap X button + new Rules button in a row

Find the current X-only button line (line ~14050):

```tsx
          <SalindaButton text="X" color="red" width={hudExitButtonWidth} height={hudButtonHeight} fontSize={hudExitButtonFontSize} onPress={()=>{ if (state.isTutorial) tutorialBus.emitRequestExit(); else dispatch({type:'RESET_GAME'}); }} style={{ marginBottom: -8 }} />
```

Replace it with a horizontal row that holds both the X button and the new Rules button:

```tsx
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: -8 }}>
            <SalindaButton text="X" color="red" width={hudExitButtonWidth} height={hudButtonHeight} fontSize={hudExitButtonFontSize} onPress={()=>{ if (state.isTutorial) tutorialBus.emitRequestExit(); else dispatch({type:'RESET_GAME'}); }} />
            <SalindaButton text={t('ui.rules')} color="blue" width={hudExitButtonWidth} height={hudButtonHeight} fontSize={hudButtonFontSize} onPress={() => setRulesOpen(true)} />
          </View>
```

> Note: `marginBottom: -8` moves from each individual button to the wrapping row so the vertical spacing in the parent column is unchanged. `hudButtonFontSize` (10–11 px) keeps label legible at this width.

---

#### Edit C — Add Rules modal at the bottom of `TurnTransition`'s JSX

Find the closing tags just before `TurnTransition` returns (lines ~14806–14810):

```tsx
    </View>
    </WebGameScreenFrame>
  );
}
```

Insert the modal just before `</WebGameScreenFrame>`:

```tsx
      {rulesOpen && (
        <AppModal
          visible={rulesOpen}
          onClose={() => setRulesOpen(false)}
          title={t('start.rulesModalTitle')}
          overlayOpacity={0.82}
          topAligned
          boxStyle={{
            width: '100%',
            height: '85%',
            marginTop: 80,
            borderRadius: 0,
            backgroundColor: 'rgba(15,23,42,0.94)',
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.45)',
            padding: 0,
          }}
        >
          <RulesContent state={state} />
        </AppModal>
      )}
    </View>
    </WebGameScreenFrame>
  );
}
```

> `RulesContent` accepts `state: GameState | null`. Passing the live `state` shows game-aware rules (e.g., enabled operators, fractions). No `pregame` prop needed when `state` is non-null.

---

- [ ] **Step 1: Apply Edit A** — add `rulesOpen` state to `TurnTransition`

- [ ] **Step 2: Apply Edit B** — replace X button with row containing X + Rules buttons

- [ ] **Step 3: Apply Edit C** — insert AppModal with RulesContent at end of TurnTransition JSX

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Visual smoke-test**

Start the app, start a game, reach the turn-transition screen. Confirm:
- "חוקים" button appears beside the X button at the top of the right HUD column
- Both buttons are the same height
- Tapping "חוקים" opens a modal with the rules content
- Tapping the modal backdrop/close button dismisses it
- The X (exit) button still works correctly
- Tournament, coin badge, and sound buttons are visually unaffected

- [ ] **Step 6: Commit**

```bash
git add index.tsx
git commit -m "feat: add rules button next to X in TurnTransition HUD"
```
