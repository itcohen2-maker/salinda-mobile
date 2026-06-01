# Salinda — Full Game Spec (Single Source of Truth)

> מסמך אפיון טכני ומשחקי מלא, נכתב מתוך קריאה ישירה בקוד (לא מהזיכרון).
> מיועד ל-Senior AI Architect לצורך תכנון השלבים הבאים.
> תאריך הפקה: 2026-06-01.

---

## 0. הערה ארכיטקטונית קריטית — שתי מערכות נפרדות

לפני הכל, חובה להבין שבקוד קיימות **שתי מכניקות נפרדות** של בניית משוואה, ובכוונה הן לא חולקות סטייט:

| | **המשחק החי (Live Game)** | **חדר הזהב (Gold Room / Onboarding)** |
|---|---|---|
| מיקום | `server/src/gameEngine.ts`, `shared/validation.ts`, `shared/cardValidation.ts`, `server/src/equations.ts` | `src/goldroom/*` (`DiceEquationRound.tsx`, `SpecialCardsIntro.tsx`, `GoldEquationTrack.tsx`) |
| מטרה | המשחק התחרותי המלא (multiplayer / vs-bot / solo) | סביבת אונבורדינג "פרימיום", **מנותקת לחלוטין** מהאנגין |
| הסיבה לניתוק | — | "so the room stays a premium, bug-free experience that can never break the real game" (תיעוד בראש `DiceEquationRound.tsx`) |

**הסמלים שהוזכרו בבריף** (`selectedCard`, `placed`, `calcResult`, `setFlying`, `doShake`) — **כולם שייכים לחדר הזהב** (`DiceEquationRound.tsx`), ולא למנוע המשחק החי. סעיפים 1–3 כאן מתעדים את **שתי** המערכות במפורש כדי שלא תהיה אי-בהירות.

---

## 1. מכניקת הליבה וזרימת הסיבוב (Core Gameplay Loop)

### 1.1 חוק הניצחון ("Golden Rule") — המשחק החי
- מתחילים עם **7 קלפים** ביד (`CARDS_PER_PLAYER = 7`, ב-`shared/gameConstants.ts`).
- **מנצחים כשמגיעים ל-2 קלפים או פחות** ביד — `checkWin()` ב-`server/src/gameEngine.ts` (≈ שורה 396): `if (cp.hand.length <= 2) → game-over`.
- אזהרה: כשנשארים 3 קלפים (לשחקן אנושי, לא בוט) — toast `threeCardsLeft`.
- `Player.hasOneCardLeft` (ב-`shared/types.ts`) מסמן את מצב הקלף האחרון.
- **חוק Overflow**: אם היד מגיעה ל-≥ 9 קלפים (`OVERFLOW_SWAP_THRESHOLD = 9`, ב-`shared/overflowSwap.ts`) — במעבר התור נכפה swap בין היד לערימת ההשלכה.

### 1.2 Scan & Discover — סריקה וגילוי (מתועד בחדר הזהב, סעיף PLUS/MINUS)
זהו מודל ה"סריקה" שמלמדים אותו בחדר הזהב, והוא משקף נאמנה את חוויית המשחק החי:
- **הקוביות הן ה-INPUT**. השחקן בונה משוואה **מהקוביות**, לא מהקלפים.
- **היד/המניפה מחזיקה את קלפי ה-TARGET**. אחרי שמחשבים את תוצאת משוואת-הקוביות, מקישים על **קלף היד היחיד ששווה לתוצאה**, ו"בדוק" מעיף אותו מהיד.
- **PLUS (שלב 1, "almost everything solvable")**: כמעט כל קלף ניתן לפתרון — הזמנה עדינה, בלי קלף "נכון" יחיד מוכתב.
- **MINUS (שלב 2, "scan & discover אמיתי")**: לא כל קלף בר-השגה. השחקן **חייב לסרוק** ולבחור קלף שאליו אפשר באמת לבנות תרגיל.
- בכל סבב בחדר הזהב היד נבנית מתוך קבוצת ה-`reachable` (כל הערכים שניתן להגיע אליהם מהקוביות) + decoys לא-פתירים, כך שהסריקה "כנה": מה שנראה פתיר באמת פתיר.

### 1.3 השמדת/העפת קלף מהיד (איך מנצחים)
- **המשחק החי**: בונים משוואה תקפה (`equationMatchesDiceAndResult()` ב-`shared/validation.ts`) שתוצאתה = ערך קלף-מטרה; הקלפים ש"שוחקו" מסוננים מהיד (`hand.filter(c => !stIds.has(c.id))`) ועוברים ל-`discardPile`. מורידים קלפים → מתקרבים ל-2 → ניצחון.
- **חדר הזהב**: התאמה מדויקת בלבד — `selectedCard.value === result`. בהצלחה הקלף "עף" החוצה (אנימציית `FlyingCard`) ומוסר מהיד ב-`finishWin()`.

### 1.4 תפקיד 3 הקוביות
- **תמיד 3 קוביות d6** (`diceMode='3'` ברירת מחדל; `rollDice()` ב-`server/src/equations.ts` מחזיר `{die1, die2, die3}`, כל אחת 1–6).
- `isTriple()` — שלוש קוביות זהות מטופלות בנפרד במשחק החי.
- `generateValidTargets(dice, enabledOperators, ...)` מייצר את כל התוצאות האפשריות מצירופי **2 קוביות או 3 קוביות**, תוך כיבוד סדר פעולות וסינון לפי `maxTarget` (ברירת מחדל 25 ב-full, 12 ב-easy).
- **חדר הזהב**: `reachableValues(dice, op)` מונה כל מספר חיובי שלם בר-השגה תחת אופרטור יחיד, משתי קוביות (כל סדר) או משלוש. השחקן **לא חייב** להשתמש בכל השלוש.

### 1.5 כפתור "בדוק ✓" (Check) — מתי פעיל, הצלחה, וכישלון (doShake)
*(מתוך `DiceEquationRound.tsx` — חדר הזהב)*
- **מתי פעיל** — `canConfirm = result !== null && placed.length >= 2 && selectedCard !== null`. כלומר: לפחות שתי קוביות מונחות, יש תוצאה מחושבת, ונבחר קלף-מטרה.
- **בלחיצה מוצלחת** — `handleCheck()` בודק `selectedCard.value === result`:
  - `setResolving(true)` (מקפיא קלט),
  - `setFlying(selectedCard)` → רכיב `FlyingCard` רץ (620ms, sfx `success`) ובסיומו קורא `finishWin()`,
  - `finishWin()` מסיר את הקלף מהיד, מאפס בחירות, ואז: אם השלב היה `plus` → מעבר ל-`minus`; אם `minus` → `onComplete()` + מסך הצלחה (🏆).
- **בטעות** — מנגנון "משחק השקט" (`doShake`): רעד עדין של הציר (Animated sequence של 5 צעדים, ~280ms), **ללא טקסט וללא צליל צורם**. אין popup. השחקן פשוט מבין שלא הסתדר וממשיך.
  - הערה: בחדר ה"מיוחדים" (`SpecialCardsIntro` → `LayerRound`) יש וריאנט שונה: כישלון מציג nudge טקסטואלי חולף ("נסו שנית — המשוואה צריכה להגיע ל-X") ל-2200ms, ללא רעד.

---

## 2. מבנה הסטייט ונתוני הקוד (State & Data Structures)

### 2.1 מבנה `Card` (טיפוס משותף)
מוגדר בשלושה מקומות מסונכרנים — `shared/types.ts`, `src/types/game.ts`, ו-`components/CardDesign.tsx`:
```ts
type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
type Operation = '+' | '-' | 'x' | '÷';
type Fraction  = '1/2' | '1/3' | '1/4' | '1/5';

interface Card {
  id: string;            // "c-<hex>" במנוע החי; "gr-hand-..." בחדר הזהב
  type: CardType;
  value?: number;        // לקלפי מספר
  fraction?: Fraction;   // לקלפי שבר
  operation?: Operation; // לקלפי פעולה
  resolvedValue?: number;  // נקבע כשקלף 'wild' מושלך בתוך משוואה (0–25)
  resolvedTarget?: number; // (קיים ב-CardDesign בלבד)
}
```
- וריאנטים: `number {value}`, `fraction {fraction}`, `operation {operation}`, `joker {}` (ללא שדות נוספים), `wild {resolvedValue?}`.

### 2.2 `selectedCard` (חדר הזהב — `DiceEquationRound.tsx`)
- הסטייט הגולמי הוא **`selectedId: string | null`** (id של קלף ביד).
- `selectedCard` נגזר ב-`useMemo`: `hand.find(c => c.id === selectedId) ?? null`.
- `selectedIds` = `Set([selectedId])` להעברה ל-`HandFan`.
- בחירה/ביטול ב-`tapCard(card)`: toggle — אם כבר נבחר, מבטל; אחרת בוחר. נחסם בזמן `resolving` ועל קלף שאינו מספרי.
- האובייקט עצמו הוא `Card` מלא (`{id, type:'number', value}`), וההשוואה לניצחון היא `selectedCard.value === result`.

### 2.3 מערך הקוביות שנבחרו (`placed`) וחישוב `result`
- **`placed: number[]`** — מערך **אינדקסים** של קוביות (0/1/2) בסדר ההקשה, לא ערכים.
- `tapDie(idx)`: אם כבר ב-placed → מסיר; אם `length >= 3` → מתעלם; אחרת מוסיף בסוף.
- **`calcResult(placed, dice, op)`**:
  - פחות משני operands ⇒ `null` (אין תוצאה עדיין).
  - אחרת: `acc = dice[placed[0]]`, ואז לולאה `applyOperation(acc, op, dice[placed[i]])` שמאל-לימין. כל `null` (למשל חילוק לא-שלם) מבטל את התוצאה.
- `result = useMemo(() => calcResult(placed, round.dice, op), [placed, round.dice, op])` — מתחשב בזמן אמת בכל הקשה.
- ב-`SpecialCardsIntro` הלוגיקה שונה: reducer (`eqReducer`) עם `slots: [number|null, number|null]` ואופרטור יחיד שניתן ל-toggle (`+`/`−`); `recompute()` קורא ל-`applyOperation`.

### 2.4 סטייט האנימציות
*(חדר הזהב — `DiceEquationRound.tsx`)*
- `substage: 'roll' | 'solve'` — שלב הטלת הקוביות מול שלב הפתרון.
- `resolving: boolean` — מקפיא קלט בזמן רצף הניצחון.
- **`flying: Card | null`** — הקלף המתאים שעף החוצה לעבר הערימה; כשלא-null מרונדר `FlyingCard`, שב-`onDone` קורא ל-`finishWin`.
- `showSuccess: boolean` — מסך הסיום (🏆).
- `shake: Animated.Value` — ערך הרעד שמזין `translateX` (interpolate ‎-9..9), מונע ע"י `doShake`.
- אנימציות נוספות: `FanReveal` (spring rise+fade של המניפה), `SuccessCelebration` (spring pop של הגביע), `GlowCard`/`Reveal` (הילה פועמת בחדר המיוחדים).

---

## 3. רכיבי ממשק משתמש (UI Component Architecture)

### 3.1 מניפת הקלפים (The Fan / מניפה)
- רכיב משותף יחיד: **`HandFan`** (`components/HandFan.tsx`) — משמש זהה במשחק החי, בתרגול ובדמו של חדר הזהב.
- API: `cards`, `width`, `selectedIds: Set<string>`, `onTapCard`.
- ממורכז לרוחב **הפריים** (לא לחלון): `fanW = Math.min(winW, 480)` — אחרת המניפה "נתקעת" מחוץ למרכז בווב.
- ניתן להחליק בין הקלפים (swipe), והקשה נותנת פידבק קלף פרימיום (הרמה/בורדר זהב — ראה `BaseCard`).
- בזמן `resolving` ה-wrap עובר ל-`pointerEvents="none"`.

### 3.2 "המיני קלפים" (Mini Cards)
- **`MiniResultCard`** (`components/CardDesign.tsx`, 36×48px, רדיוס 8) — קלף מוקטן שמופיע עם אנימציית flip (rotateY 90°→0°) + stagger לפי `index` (120ms).
- משמש להציג **תוצאות / ערכים** בתצוגה מצומצמת (למשל valid targets / תוצאת תרגיל), צבע לפי `getNumColors(value)`.
- בנוסף, כל `GameCard` תומך ב-prop `small` (100×140 במקום 110×158) — גרסת "מיני" של הקלף המלא, בה משתמשים ב-`FlyingCard` ובמצבים צפופים.

### 3.3 תצוגת הקוביות וכפתור הבדיקה
- **קוביות**: `AnimatedDice` (+ `GoldDieFace`) — רכיב משותף. בחדר הזהב: `fixedFinalValues={round.dice}`, `autoRollOnMount`, `hideRollButton`, `hideSumBadge`, callback `onRollComplete → setSubstage('solve')`.
- אחרי הנחיתה, כל קובייה הופכת ל-`DiceChip` לחיץ (gold chip 38px); קובייה מונחת מתעמעמת ומקבלת badge עם **סדר** ההנחה (`order = placed.indexOf(idx)+1`).
- **ציר המשוואה** (`EquationTrack`): operands מונחים מחוברים ב-`OperatorGlyph`, slot ריק מקווקו מרמז שיש מקום לעוד (עד 3), ואז `= result`. כפוי `direction: 'ltr'` כדי שה-RTL של העברית לא ישקף את המשוואה.
- **כפתור "בדוק ✓"**: `GoldButton` (height 50, fontSize 18), `disabled={!canConfirm}` — מתעמעם עד שהמשוואה מוכנה. אף פעם לא מורידים אותו ל-`SalindaButton` (זה ה-look הישן).
- ב-`GoldEquationTrack` (מצב source-bubble): מספרי מקור לחיצים מעל הציר, כפתור אופרטור שמחליף `+`/`−`, ו-`בדוק ✓` שמופעל כששני ה-slots מלאים.

---

## 4. קלפים מיוחדים ומכניקות מתקדמות (Special Cards & Progression)

### 4.1 סימני פעולה (Operators) — קלפי `operation`
- ערכים: `'+' | '-' | 'x' | '÷'`. `applyOperation` (ב-`src/utils/arithmetic.ts`): חילוק מחזיר `null` אם לא מתחלק שלם (`b !== 0 && a % b === 0`).
- **במשחק החי**: קלפי פעולה שמישים **רק בתוך משוואה** (`playOperation()` מחזיר שגיאה `onlyInEquation`). מקסימום **2 אופרטורים** למשוואה (מיקומים 0,1), מקסימום פעולה אחת ב-staged set יחיד.
- **סדר פעולות**: × ÷ קודמים ל-+ − (`evalEquationThreeTerms` / `evalThreeTerms`).
- ספירת חבילה: 4 מכל סוג (3 עבור ÷) — `server/src/deck.ts`.
- **אונבורדינג** (`SpecialCardsIntro`): הסימנים ממוסגרים כ"שדרוג עוצמה / הנשק הסודי"; התרגיל המבוים `4 ? 3 = 7` (target 7), המבוסס על legacy lessons 35–36.

### 4.2 ג'וקרים / קלפי פרא — שני טיפוסים נפרדים!
חשוב: בקוד יש **שני** טיפוסים שונים, ואין לבלבל ביניהם.

**א. `joker` ("קלף סלינדה" / ג'וקר אופרטור — "כל הסימנים"):**
- מחליף **כל אופרטור** במשוואה. חייב לציין `jokerAs: Operation` (או `chosenOperation` ב-action `PLAY_JOKER`).
- שמיש **רק בתוך משוואה** (`playJoker()` בנגיעה ישירה נדחה).
- 4 קלפים בחבילה. בתצוגה: `JokerCard` עם `JesterSvg` + 4 פינות סימנים (`+ ÷ × −`).
- באונבורדינג ממוסגר כ"קלף סלינדה — הכוח המוחלט שמכיל את כל הסימנים" (glyph ♛, `SpecialCardsIntro` phase `salinda-reveal`/`salinda-round`).

**ב. `wild` (קלף פרא — "כל מספר"):**
- ללא ערך על הערימה; מתפקד כ**כל מספר 0–maxNumber** (עד 25 ב-full). בבונה המשוואה השחקן פותר אותו לערך ספציפי; `resolvedValue` נקבע כשמושלך בתוך משוואה.
- **מקסימום wild אחד למשוואה / staged set** (`shared/cardValidation.ts`). (תואם לזיכרון "card-staging-rules": wild — מקסימום 1.)
- ב-overflow swap חזרה ליד, `resolvedValue` מתאפס ל-undefined.
- ספירה: `wildDeckCount(maxNumber, includeFractions)` — 3 או 4.
- בתצוגה: `WildCard` סגול עם ★ ו-"0-25".

### 4.3 שברים (Fractions) — קלפי `fraction`
- ערכים: `1/2, 1/3, 1/4, 1/5`. ספירת חבילה ברירת מחדל: `{1/2:6, 1/3:4, 1/4:3, 1/5:2}`.
- **מכניקת התקפה/הגנה** (לא חלק מהסכום!):
  - `playFraction()` על קלף המספר העליון בערימה: הערך העליון חייב להתחלק במכנה; נקבע `pendingFractionTarget = topValue / denominator`.
  - השחקן הבא **מתגונן** (`defendFractionSolve()`): משחק מספר/wild שמתחלק במכנה, או **מושך קלף עונשין**. שברים יכולים לחסום שברים (חלוקה נוספת — stacking).
- **חוק קריטי**: שברים **אף פעם לא נכנסים לסכום/למשוואה** (לא מותרים ב-`confirmStaged()`). (תואם לזיכרון "card-staging-rules": fraction — never in sum.)
- פונקציות עזר ב-`arithmetic.ts`: `fractionToDecimal`, `fractionDenominator`, `isDivisibleByFraction`, `applyFraction`.
- **סטטוס באונבורדינג**: tile "שברים" עדיין **"בקרוב"** (אין `steps`/`interactive`) — מתוכנן, לא ממומש כשיעור אינטראקטיבי בחדר הזהב.

---

## 5. מבנה ה-Hub וה-Onboarding (חדר הזהב)

מקור: `src/goldroom/GoldRoomScreen.tsx`. חדר הזהב הוא overlay (RN `Modal`) **admin-only** שצף מעל האפליקציה החיה ולא משנה בה דבר. בווב ממוסגר ל-`maxWidth: 480` (פריים טלפון).

### 5.1 קטלוג האריחים (`TASKS`) וסדר ה-Hub
רשת 2-בשורה, מסודרת (RTL) לפי הסדר:

| # | `id` | אייקון | כותרת | סוג | מצב נעילה |
|---|------|--------|-------|-----|-----------|
| 1 | `basics` | 🪙 | היסודות | `steps` (BASICS_STEPS) — או מפנה לטוטוריאל החי דרך `onStartLiveTutorial` | פתוח |
| 2 | `equation-practice` | 🎲 | תרגול | `interactive` → `DiceEquationRound` | פתוח |
| 3 | `operations` | ⚡ | מיוחדים | `interactive` → `SpecialCardsIntro` | פתוח |
| 4 | `fractions` | ½ | שברים | — (אין steps) | 🔒 בקרוב |
| 5 | `jokers` | 🃏 | ג'וקרים | — (אין steps) | 🔒 בקרוב |
| 6 | `coin-collection` | 🪙 | מטבעות | `reward` | 🔒 עד השלמת הלמידה |

- **BASICS_STEPS** (3 צעדים, spotlight): ברוך הבא → הערימה (deck, ספוט ימני-עליון) → המניפה (fan, דים מלא + מניפת דמו של 7 קלפים אמיתיים). בסיום, "היסודות" זורם **ישר** ל-`equation-practice` (ראה לוגיקת `onComplete`).
- מצבי אריח: `התחל ›` / `הושלם ✓` / `🔒 בקרוב`; אריח ה-reward: `🔒 סיים ללמוד` / `אסוף ›` / `נאסף ✓`.

### 5.2 חסימת שלבים ומענק המטבעות (`REWARD_REQUIREMENTS`)
- **`REWARD_REQUIREMENTS = ['basics', 'equation-practice', 'operations']`** — שלוש משימות היסוד. **שברים וג'וקרים אינם נדרשים** למענק.
- `rewardEligible = REWARD_REQUIREMENTS.every(id => isComplete(id))`. אריח המטבעות נשאר נעול עד שכולן הושלמו.
- בלחיצה כשזכאי ולא נאסף: `handleCollectReward()` קורא ל-`auth.awardCoins(SALINDA_GOLD_ROOM_REWARD, 'gold_room_complete')`.
  - **`SALINDA_GOLD_ROOM_REWARD = 500`** (`shared/salindaEconomy.ts`).
  - המענק הוא **חד-פעמי**: השרת (`award_coins`) הוא single-grant לכל `(player, source)`, ולכן בטוח גם אם הסטייט המקומי נמחק. מסמנים `coin-collection` כהושלם רק כשהזיכוי באמת נחת (`res === 'ok'`).
  - כישלון (offline): overlay "אופס…" עם "נסה שוב"; כלום לא מסומן.
- מעקב התקדמות מנוהל ב-`useTrainingProgress()` (AsyncStorage), עם `isComplete` / `markComplete`.

### 5.3 כלכלה רחבה יותר (`salindaEconomy.ts`) — רקע
- `SALINDA_TUTORIAL_REWARDS = { basic: 150, advanced: 250 }`.
- `SALINDA_GAMEPLAY_REWARDS = { excellence_meter_full: 1, standard_win: 100, first_win_of_day: 300 }`.
- `SALINDA_CATALOG`: `table_design` (20 מטבעות), `background_design` (25).
- מקורות מטבעות (`SALINDA_COIN_SOURCES`) כוללים `gold_room_complete`, `game_courage`, `first_win_of_day` ועוד.

---

## 6. נספח — מפת קבצים קריטיים

| תחום | קבצים |
|------|-------|
| מנוע משחק חי | `server/src/gameEngine.ts`, `server/src/equations.ts`, `server/src/deck.ts` |
| ולידציה משותפת | `shared/validation.ts`, `shared/cardValidation.ts`, `shared/overflowSwap.ts`, `shared/equationOpCycle.ts` |
| קבועים/טיפוסים | `shared/gameConstants.ts`, `shared/types.ts`, `src/types/game.ts` |
| אריתמטיקה | `src/utils/arithmetic.ts` |
| חדר הזהב | `src/goldroom/GoldRoomScreen.tsx`, `DiceEquationRound.tsx`, `SpecialCardsIntro.tsx`, `GoldEquationTrack.tsx`, `goldRoomLayers.ts`, `useTrainingProgress.ts` |
| כלכלה | `shared/salindaEconomy.ts` |
| תצוגת קלפים | `components/CardDesign.tsx`, `components/HandFan.tsx`, `components/GoldButton.tsx`, `src/components/ui/OperatorGlyph.tsx` |
| קוביות | `AnimatedDice.tsx` |
| בית חי / Hub | `index.tsx` (PlayModeChoiceScreen) |

---

## 7. פערים ידועים / מתוכנן-מול-ממומש (לתשומת לב הארכיטקט)
1. **שברים וג'וקרים** קיימים ומלאים במנוע החי, אך באונבורדינג של חדר הזהב הם עדיין tiles "בקרוב" (לא אינטראקטיביים).
2. **ניתוק מכוון** של חדר הזהב מהאנגין החי: כל לוגיקת ה-flow/ולידציה בחדר משוכפלת מקומית. שינוי באנגין החי **לא** מתעדכן אוטומטית בחדר.
3. **"קלף סלינדה"** באונבורדינג = `joker` במנוע החי (אין טיפוס `salinda` נפרד). יש להבחין בין `joker` (אופרטור) ל-`wild` (מספר).
4. ספוטלייט בחדר הזהב משתמש ב**שברי מסך** ולא ב-rects נמדדים — מתוכנן להחלפה כשירוץ מעל לוח אמיתי.
