# סיכום משימה — "חדר הזהב" (Gold Room) · Handoff

## 🎯 המטרה
מסך הדרכה חדש, נפרד, **גלוי רק לאדמין**, בסגנון "זהב מלוטש", שלא פוגע באפליקציה הקיימת.

## 🎨 החלטות עיצוב
- השראה: תמונה של לוח עץ צבוע זהב.
- נבחר סגנון **"D — זהב מלוטש"**: מעבר מתכתי חלק (בהיר למעלה → כהה למטה), **בלי פסי עץ**, עם ברק עליון.
- פלטת זהב: `#F8E08E`, `#F0C659`, `#D9A23A`, `#8A5A1C` · טקסט `#5E3A10` · מסגרת `#8A5A1C`.
- כפתור: זהב תלת-ממדי לחיץ (לוח זהב על בסיס כהה שנלחץ פנימה).

## 📂 קבצים — מה נוצר ומה שונה
1. **`components/GoldButton.tsx`** — חדש. כפתור זהב תלת-ממדי לחיץ (Pressable + expo-linear-gradient + אנימציית לחיצה). RN טהור, עובד web+native.
2. **`src/goldroom/GoldRoomScreen.tsx`** — חדש. "חדר הזהב": Modal מסך-מלא צף, זהב מלוטש, כפתורי דלג/חזור/✕, נקודות שלבים, כפתור "המשך", **3 שלבי דוגמה (placeholder)**. עצמאי לגמרי — לא נוגע בכלום משותף.
3. **`index.tsx`** — שונה. החיבור האמיתי:
   - import ל-`GoldRoomScreen` ו-`GoldButton`.
   - בקומפוננטה `PlayModeChoiceScreen` (מסך הבית האמיתי): state `goldRoomOpen` + `forceGoldRoom`.
   - כפתור כניסה **"🪙 חדר הזהב"** בתוך בלוק `{isFeedbackAdmin && (...)}` (אדמין בלבד).
   - רינדור `<GoldRoomScreen visible={goldRoomOpen || forceGoldRoom} ... />`.
   - דיפ-לינק תצוגה לפיתוח: `?goldroom=1` (עובד רק ב-`__DEV__` + web).
4. **`src/components/HappyBubble.tsx`** — שונה. כל 6 הטונים → זהב מלוטש D (expo-linear-gradient + ברק).
   ⚠️ **רכיב משותף!** משמש גם ב-`index.tsx` (ברוך הבא ×2, חגיגה) וגם בהדרכה הקיימת → הזהב מופיע גם באפליקציה הקיימת. **ההחלטה: להשאיר ככה (לא לבטל).**
5. **`src/tutorial/InteractiveTutorialScreen.tsx`** — שונה. כפתור "הבנתי/המשך": native → `GoldButton`; web → סגנון זהב inline. (זו ההדרכה הקיימת.)

## ⚠️ תגלית חשובה
יש שתי קומפוננטות "StartScreen". `src/components/screens/StartScreen.tsx` הוא **קוד מת** (רק הטסט שלו מייבא אותו). מסך הבית האמיתי = `PlayModeChoiceScreen` ב-`index.tsx`. בהתחלה חיברתי בטעות לקובץ המת — תוקן, הוחזר למקור, וחובר נכון ל-`index.tsx`.

## 🔑 זיהוי אדמין
`src/admin/useAdminAccess.ts` → `{ isAdmin }`. במסך הבית דרך `useFeedbackAdmin()` → `isFeedbackAdmin` (בודק טבלת `admin_users` ב-Supabase).

## 🔬 אימות
- `npx tsc --noEmit` → **0 שגיאות** בכל הפרויקט.
- טסטים: `npx jest src/tutorial` → **203/203 עברו**.
- ויזואלי: אומת בצילומי מסך (Edge/Playwright) — החדר צף מעל הבית המעומעם, ניווט שלבים עובד.

## ▶️ הרצה ותצוגה מקומית
- שרת: `npm run web` → http://localhost:8081
- תצוגת חדר הזהב (פיתוח בלבד): http://localhost:8081/?goldroom=1
  - מומלץ לזרוע `localStorage.setItem('salinda_tutorial_done','true')` כדי לא להינתב אוטומטית להדרכה.
- בשימוש אמיתי: אדמין רואה כפתור **"🪙 חדר הזהב"** בתפריט הבית.

## 🛠️ מגבלות React Native (לזכור בעיצוב)
לא נתמכים: `mix-blend-mode`, `repeating-linear-gradient`, `::before/::after`, `inset box-shadow`, `background-clip:text`. משתמשים ב-`LinearGradient` + שכבות View.

## 📌 הצעדים הבאים
1. **למלא תוכן אמיתי** ב-`STEPS` שבתוך `src/goldroom/GoldRoomScreen.tsx` (כרגע placeholder).
2. להחליט אם משאירים את הזהב בבועות/כפתור ההדרכה הקיימים (כרגע: נשאר).
3. לנקות/לשמור קבצי עזר ברפו: `tutorial-mockup.html`, `bubble-redesign-options.html`, `polished-color-bubbles.html`, `tmp-goldroom-1.png`, `tmp-goldroom-2.png`.

## 🧩 הערה
התקנת דפדפן Playwright (chromium) נתקעה — השתמשתי ב-`channel:'msedge'` לצילומים.
פקודת "פוש" = add -A + commit + push + מעקב דיפלוי.
