# Bot Difficulty Block in StartScreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the existing `BotDifficultySettingsBlock` (easy/medium/hard toggle + bot name) in the StartScreen whenever the game mode is vs-bot, including when arriving from the GameEntryChoiceScreen lobby.

**Architecture:** `BotDifficultySettingsBlock` is fully built at `index.tsx:12370` but never rendered. `showBotSettings = gameMode === 'vs-bot'` is computed at line 10185 but unused. The fix is (1) add `botSettingsWheelIndex` to the wheel calculation so the block participates in the 3D tilt math, and (2) render the block in the JSX between the player-count row and the number-range row.

**Tech Stack:** React Native, TypeScript, `index.tsx` (monolith)

---

## File Map

| File | Change |
|------|--------|
| `index.tsx` | Add `botSettingsWheelIndex` to wheel calc (line ~10192); add `<BotDifficultySettingsBlock>` to JSX (line ~11561) |

---

### Task 1: Wire botSettingsWheelIndex into the wheel calculation

**Files:**
- Modify: `index.tsx:10192-10194`

- [ ] **Step 1: Add `botSettingsWheelIndex` between `playerCountWheelIndex` and `numberRangeWheelIndex`**

Find the block at line ~10191:
```typescript
  const playerCountWheelIndex = showPlayerCountRow ? nextWheelIndex++ : null;
  const numberRangeWheelIndex = nextWheelIndex++;
  const guidanceWheelIndex = nextWheelIndex++;
  const advancedWheelIndex = nextWheelIndex++;
```

Replace with:
```typescript
  const playerCountWheelIndex = showPlayerCountRow ? nextWheelIndex++ : null;
  const botSettingsWheelIndex = showBotSettings ? nextWheelIndex++ : null;
  const numberRangeWheelIndex = nextWheelIndex++;
  const guidanceWheelIndex = nextWheelIndex++;
  const advancedWheelIndex = nextWheelIndex++;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\asus\bmad\card && npx tsc --noEmit 2>&1 | grep -i "botSettings\|wheelIndex" | head -10
```
Expected: no errors.

---

### Task 2: Render the BotDifficultySettingsBlock in the JSX

**Files:**
- Modify: `index.tsx:11560-11562`

- [ ] **Step 1: Add the bot settings WheelRow after the player-count block**

Find the comment at line ~11561:
```tsx
          {/* 2. מספר שחקנים — מוצג רק במצב מקומי */}
          {showPlayerCountRow && playerCountWheelIndex != null ? (
```

Insert AFTER the closing `null}` of the player-count block (around line 11636) and BEFORE the `{/* 3. טווח מספרים */}` comment:

```tsx
          {/* 3. הגדרות בוט — מוצג רק במצב בוט */}
          {showBotSettings && botSettingsWheelIndex != null ? (
            <WheelRow index={botSettingsWheelIndex}>
              <BotDifficultySettingsBlock
                botDifficulty={botDifficulty}
                setBotDifficulty={setBotDifficulty}
                botDisplayName={botDisplayName}
                setBotDisplayName={setBotDisplayName}
              />
            </WheelRow>
          ) : null}
```

Update the comment numbering for the existing rows that follow:
- `{/* 3. טווח מספרים */}` → `{/* 4. טווח מספרים */}`
- `{/* 4. הדרכה */}` (or similar guidance comment) → `{/* 5. הדרכה */}`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\asus\bmad\card && npx tsc --noEmit 2>&1 | grep -i "botSettings\|BotDiff" | head -10
```
Expected: no errors.

- [ ] **Step 3: Run existing tests**

```bash
cd C:\Users\asus\bmad\card && npx jest --watchAll=false --passWithNoTests 2>&1 | tail -5
```
Expected: same pass/fail count as before (no new failures).

- [ ] **Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat: show BotDifficultySettingsBlock in StartScreen for vs-bot mode"
```

---

### Task 3: Manual verification checklist

- [ ] **Flow A — GameEntryChoiceScreen → vs-bot:**
  1. Open app, go to game entry, tap "מול בוט"
  2. StartScreen should show the blue bot-settings block (רמת בוט: קל/בינוני/קשה + bot name field)
  3. Change difficulty to "קשה", tap "בואו נשחק" → game starts with hard bot

- [ ] **Flow B — lockGameMode=false (manual mode selection):**
  1. Open StartScreen in full mode (not locked)
  2. Select "מול בוט" in the mode row → bot-settings block appears
  3. Switch to "סולו" → bot-settings block disappears
  4. Switch to "עם חברים" (pass-and-play) → bot-settings block disappears, player count appears

- [ ] **Flow C — online lobby → "שחק מול בוט":**
  1. Open an online table, press the bot button
  2. StartScreen opens with vs-bot locked → bot-settings block is visible
  3. Difficulty selection works, "בואו נשחק" starts game with chosen difficulty

- [ ] **Verify difficulty actually affects the bot:**
  1. Start game with "קל" (easy) → bot plays noticeably weaker
  2. Start game with "קשה" (hard) → bot plays optimally

---

## Testing Checklist

After all tasks complete:
- [ ] Bot difficulty block visible when mode = vs-bot ✓
- [ ] Bot difficulty block hidden when mode = solo or pass-and-play ✓  
- [ ] `botDifficulty` state (default 'medium') passed to `START_GAME` action ✓ (already wired at line 10429)
- [ ] No regression in other modes ✓
