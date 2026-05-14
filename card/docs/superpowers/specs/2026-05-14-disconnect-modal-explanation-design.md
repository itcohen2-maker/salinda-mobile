# Disconnect Choice Modal — Explanation Text

**Date:** 2026-05-14  
**Status:** Approved

## Problem

When an opponent disconnects during an online game, a modal appears with two buttons
("Accept technical victory" / "Continue vs bot") but no explanation of what happened.
The player has no context for why the choice is being presented.

## Design

Add a clear title and subtitle to the existing `disconnectChoiceModal` in `index.tsx`.

### Modal structure

```
[ Title ]    "היריב עזב את המשחק" / "Your opponent left"
[ Subtitle ] "{name} יצא. בחרו כיצד להמשיך:" / "{name} left the game. Choose how to continue:"
[ Buttons ]  [קבל ניצחון טכני / Accept technical victory]  [המשך מול בוט / Continue vs bot]
```

### Text by locale

| Element   | Hebrew                                     | English                                          |
|-----------|--------------------------------------------|--------------------------------------------------|
| Title     | `היריב עזב את המשחק`                       | `Your opponent left`                             |
| Subtitle  | `{name} יצא. בחרו כיצד להמשיך:`           | `{name} left the game. Choose how to continue:` |

### After each choice (unchanged)

- **Technical victory** → server marks game `game-over` → GameOver screen as today
- **Continue vs bot** → opponent replaced with bot, game continues as today

## Scope

Single change: the JSX block for `disconnectChoiceModal` in `index.tsx` around line 18727.
No changes to `useMultiplayer.tsx`, server, i18n files, or navigation logic.
