# בדיקת התחברות Google בפיתוח (Dev Login)

מדריך קצר להרצת המשחק ולבדיקת התחברות Google כמשתמש רשום — בלי שזה יזרוק אותך לאתר.

> **רקע (למה זה היה נשבר):** ב-Expo Go על LAN, כתובת ה-redirect היא IP גולמי, ו-Supabase/GoTrue דוחה אותו → נופלים לאתר. הפתרון: באנדרואיד משתמשים ב-**dev-client** (סכימה `salinda-dev://`), ובאייפון ב-**tunnel** (כתובת עם שם-מארח שמתקבל).

---

## מריצים פקודה אחת בכל פעם (לפי המכשיר)

אפשר להריץ כל מכשיר בנפרד, או להריץ את שניהם יחד עם `./dev-both.ps1`.

| בודק על | פקודה | איך נכנסים |
|---------|-------|-----------|
| **אנדרואיד** | `npm start` או `npm run start:android-dev` | פותחים את אפליקציית **Salinda (dev)** — מתחברת ל-8081. **בלי tunnel.** |
| **אייפון** | `npm run start:go-tunnel` או `npm run start:ios-go` | פותחים **Expo Go** → סורקים QR / נכנסים דרך הכתובת של 8082 |

אחרי שהמשחק נטען → מתחברים עם Google → חוזרים לאפליקציה. ✅

---

## אנדרואיד — פירוט

1. `npm start`
2. פותחים את **Salinda (dev)** בטלפון (אייקון נפרד, חבילה `com.salinda.game.dev`).
   - מתחברת לבד ל-Metro ב-LAN. אם לא — סורקים את ה-QR שבטרמינל, או דרך USB:
     `adb reverse tcp:8081 tcp:8081` ואז פותחים את האפליקציה.
3. מתחברים עם Google → חוזר לאפליקציה.

> אם החלפת קוד והאפליקציה לא מתעדכנת: נער את הטלפון → **Reload**.

---

## אייפון — פירוט

1. `npm run start:go-tunnel`
2. מחכים ל-`Tunnel ready.` בטרמינל.
3. פותחים **Expo Go**:
   - אם מחוברים לחשבון Expo (itzikcohen) — הפרויקט מופיע לבד תחת **Development servers**.
   - אחרת — **Enter URL manually** ומקלידים את כתובת ה-`exp://...exp.direct` שבטרמינל.
4. מתחברים עם Google → חוזר לאפליקציה.

> הכתובת `exp://...exp.direct` **משתנה בכל הפעלה**. הכי נוח: להתחבר לחשבון Expo ב-Expo Go, ואז הפרויקט מופיע לבד.
>
> אם רואים `failed to start tunnel / remote gone away` — זו תקלת ngrok זמנית. מנסים שוב, או מאוחר יותר. (שיפור אמינות: חשבון ngrok חינמי + authtoken.)
>
> אם בודקים ב-LAN במקום tunnel, הקוד לא שולח ל-Supabase את כתובת ה-IP הגולמית. הוא משתמש ב-`https://salinda-mobile.vercel.app/auth/callback?expo_return_to=...`, שנמצא ברשימת ה-Redirect URLs, ואז האתר מחזיר את הקוד ל-Expo Go והאפליקציה מחליפה אותו לסשן.

---

## הגדרות Supabase שחייבות להישאר קבועות

ב-Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://salinda-mobile.vercel.app`
- **Redirect URLs**:
  - `salinda-dev://auth/callback`
  - `salinda-dev://**`
  - `salinda://auth/callback`
  - `salinda://**`
  - `exp://**`
  - `https://salinda-mobile.vercel.app/auth/callback`
  - `https://salinda-mobile.vercel.app/auth/callback?**`

לא מוסיפים כתובת tunnel יומית ל-Supabase. הכתובת של Expo Go משתנה בכל הפעלה, ו-`exp://**` מכסה אותה.

## הגדרות מקומיות שכבר קיימות

- **`.env`** (מקומי, gitignored): `EXPO_PUBLIC_AUTH_SCHEME=salinda-dev` — נחוץ כי `eas.json` env חל רק בזמן build, לא ב-`expo start`. בלעדיו ה-dev-client מקבל redirect `salinda://` במקום `salinda-dev://`.
- **סקריפטים** ב-`package.json`: `start` / `start:android-dev` (dev-client על 8081), `start:go-tunnel` / `start:ios-go` (Expo Go tunnel על 8082).
- בזמן התחברות Google בפיתוח תופיע שורת לוג כמו `[auth] OAuth redirect (...)`. אם שוב נופלים לאתר, משווים את הכתובת בלוג לרשימת Redirect URLs למעלה.

---

## בניית dev-client מחדש (רק אם משנים native/scheme/plugins)

```
eas build --profile development --platform android
```
מורידים את ה-APK ומתקינים (`adb install -r <file>.apk`). לרוב **לא צריך** — שינויי JS נטענים מ-Metro בלי build חדש.

## iOS dev-client?
דורש חשבון Apple Developer בתשלום ($99/שנה) או Mac. עד אז — באייפון משתמשים ב-**Expo Go + tunnel** (חינם).
