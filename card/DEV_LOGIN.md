# בדיקת התחברות Google בפיתוח (Dev Login)

מדריך קצר להרצת המשחק ולבדיקת התחברות Google כמשתמש רשום — בלי שזה יזרוק אותך לאתר.

> **רקע (למה זה היה נשבר):** ב-Expo Go על LAN, כתובת ה-redirect היא IP גולמי, ו-Supabase/GoTrue דוחה אותו → נופלים לאתר. הפתרון: באנדרואיד משתמשים ב-**dev-client** (סכימה `salinda-dev://`), ובאייפון ב-**tunnel** (כתובת עם שם-מארח שמתקבל).

---

## מריצים פקודה אחת בכל פעם (לפי המכשיר)

שני השרתים רצים על פורט 8081, אז **לא** מריצים את שניהם יחד.

| בודק על | פקודה | איך נכנסים |
|---------|-------|-----------|
| **אנדרואיד** | `npm start` | פותחים את אפליקציית **Salinda (dev)** — מתחברת לבד ב-LAN. **בלי tunnel.** |
| **אייפון** | `npm run start:go-tunnel` | פותחים **Expo Go** → סורקים QR / נכנסים דרך הכתובת |

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

---

## הגדרות שכבר קיימות (לא לגעת)

- **`.env`** (מקומי, gitignored): `EXPO_PUBLIC_AUTH_SCHEME=salinda-dev` — נחוץ כי `eas.json` env חל רק בזמן build, לא ב-`expo start`. בלעדיו ה-dev-client מקבל redirect `salinda://` במקום `salinda-dev://`.
- **Supabase Redirect URLs** כוללים: `salinda-dev://auth/callback`, `salinda-dev://**`, `exp://**`, `salinda://**`.
- **סקריפטים** ב-`package.json`: `start` (dev-client), `start:go` (Expo Go LAN), `start:go-tunnel` (Expo Go tunnel).

---

## בניית dev-client מחדש (רק אם משנים native/scheme/plugins)

```
eas build --profile development --platform android
```
מורידים את ה-APK ומתקינים (`adb install -r <file>.apk`). לרוב **לא צריך** — שינויי JS נטענים מ-Metro בלי build חדש.

## iOS dev-client?
דורש חשבון Apple Developer בתשלום ($99/שנה) או Mac. עד אז — באייפון משתמשים ב-**Expo Go + tunnel** (חינם).
