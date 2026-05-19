# Online Bot → Local Game: Spec

**תאריך:** 2026-05-17
**בעיה:** כשמתחילים משחק נגד בוט דרך שולחן אונליין (bot_offer), הבוט רץ server-side עם עיכובים שונים מהמשחק המקומי. המשחק המקומי הוא ה-reference.

---

## הפתרון

כשמשתמש לוחץ "שחק נגד בוט" בשולחן אונליין (מצב `bot_offer`):
1. יוצאים מהחדר האונליין (`leaveRoom`)
2. מתחילים **local bot game** עם הגדרות השולחן — דולגים על מסך הלובי לחלוטין

---

## השינויים

### 1. `index.tsx` — callback חדש

`LobbyScreen` מקבל prop חדש:
```
onStartLocalBotGame(difficulty: 'easy' | 'full', settings: HostGameSettings): void
```

המימוש ב-`index.tsx`:
1. קורא `mp.leaveRoom()`
2. מחזיר `playMode` ל-`'game-entry'` (לא `'online'`) — חובה לפני dispatch כדי שה-render הבא יהיה local
3. מחלץ את ה-player names (שם המשתמש + שם הבוט מ-`settings.botDisplayName`)
4. מפעיל `dispatch({ type: 'START_GAME', mode: 'vs-bot', ... })` עם ההגדרות

מיפוי `HostGameSettings → START_GAME`:

| HostGameSettings | START_GAME field |
|---|---|
| `showFractions` | `fractions` |
| `fractionKinds` | `fractionKinds` |
| `showPossibleResults` | `showPossibleResults` |
| `timerSetting` | `timerSetting` |
| `timerCustomSeconds` | `timerCustomSeconds` |
| `botDifficulty` | `botDifficulty` |
| `botDisplayName` | שם שחקן בוט ב-`players` |
| `mathRangeMax` | `mathRangeMax` |
| `enabledOperators` | `enabledOperators` |
| `showSolveExercise` | `showSolveExercise` |

`difficulty` (easy/full) מגיע מה-argument ישירות.

שם השחקן האנושי: `preferredName` (זמין ב-scope של `index.tsx`).

`difficultyStage`: נגזר מ-difficulty — `'easy' → 'A'`, `'full' → 'H'`.

### 2. `OnlineTableScreens.tsx` — שינוי כפתור

ה-prop `onStartLocalBotGame` מועבר ל-`LobbyScreen`.

כפתור "שחק נגד בוט" (שורה ~1149):
```
// לפני:
await startBotGame(difficulty, buildGameSettings());

// אחרי:
onStartLocalBotGame(difficulty, buildGameSettings());
```

`setStartingBot` מוסר (כפול — המעבר הוא מיידי, לא async).

---

## מה לא משתנה

- `start_bot_game` socket handler בשרת — נשאר כמות שהוא (משמש ל-lobby הרגיל)
- `useMultiplayer.startBotGame()` — נשאר כמות שהוא
- לוגיקת `botTeachingDelayRange` ב-`index.tsx` — לא נגעים בה
- שרת — אפס שינויים

---

## edge cases

- **אם `configuredDifficulty` הוא null** (לא אמור לקרות כשמגיעים ל-`bot_offer`, אבל) — fallback ל-`'full'`
- **שם בוט ריק** — fallback לשם הבוט הדיפולטי לפי locale (כמו שעושה הלובי הרגיל)
- **`enabledOperators` ריק** — fallback ל-stageCfg כמו ב-`START_GAME` הרגיל

---

## בדיקה

1. פתח שולחן אונליין עם difficulty=easy + שברים מופעלים
2. המתן — הכפתור "שחק נגד בוט" יופיע מיד (BOT_OFFER_DELAY_MS=0)
3. לחץ — לא אמור לעבור דרך לובי, המשחק מתחיל ישירות
4. ודא שה-difficulty, שברים, טיימר, ושם הבוט תואמים את מה שהוגדר בשולחן
5. ודא שהבוט מתנהג בדיוק כמו מהלובי הרגיל (עיכובים, teaching mode)
