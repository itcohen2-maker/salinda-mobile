# Hidden Rule

פרויקט חדש ונפרד עבור `Hidden Rule`.

## מבנה התחלתי

- `design/button-system`
  רפרנס הכפתורים שסגרנו עד עכשיו.
- `design/references`
  חומרים חזותיים, ניסויי רקע, mockups, והשראות.
- `assets/ui`
  אייקונים, מסגרות, ואלמנטים מיוצאים לממשק.
- `assets/backgrounds`
  רקעים, טקסטורות, שכבות אווירה.
- `assets/audio`
  סאונד ואפקטים.
- `src/app`
  מעטפת האפליקציה והכניסה הראשית.
- `src/components/buttons`
  מימוש הכפתורים בתוך האפליקציה.
- `src/components/ui`
  רכיבי UI כלליים.
- `src/screens`
  מסכי המשחק.
- `src/theme`
  טוקנים, צבעים, טיפוגרפיה, וריווחים.
- `src/game`
  לוגיקת המשחק.
- `src/content`
  טקסטים, פרקים, רמזים, וחוקים.
- `src/lib`
  עזרי מערכת ושכבות שיתוף.

## מה כבר הועבר

- `design/button-system/button-family.css`
- `design/button-system/family-app.jsx`
- `design/button-system/Hidden Rule Button System.html`
- `design/button-system/Hidden Rule Secondary Button.html`
- `src/theme/backgroundPresets.ts`
- `src/theme/artDirection.ts`
- `src/theme/materialTokens.ts`
- `src/theme/backgroundRecipes.ts`
- `src/theme/index.ts`
- `docs/background-system.md`
- `design/button-system/design-canvas.jsx`
- `design/button-system/secondary-app.jsx`
- `src/components/ui/controlStates.ts`
- `src/components/ui/iconButtonTokens.ts`
- `src/components/ui/inputFieldTokens.ts`
- `src/components/ui/index.ts`

## הצעד הבא

1. להתחיל app shell נקי בתוך `src/app`.
2. לחבר למסכים את מתכוני הרקע מתוך `src/theme/backgroundRecipes.ts`.
3. להמיר את משפחת ה־controls מרפרנס עיצובי למימוש אפליקטיבי.
