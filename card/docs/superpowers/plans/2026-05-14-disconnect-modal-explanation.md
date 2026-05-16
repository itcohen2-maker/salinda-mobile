# Disconnect Modal Explanation Text — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear title and subtitle to the disconnect choice modal so players understand why they are being asked to choose.

**Architecture:** Single JSX edit in `index.tsx`. Replace the existing single-line player-name text with a two-line header (title + subtitle). No logic, no navigation, no i18n file changes.

**Tech Stack:** React Native / TSX, inline styles matching existing modal style conventions.

---

### Task 1: Update the disconnectChoiceModal JSX in index.tsx

**Files:**
- Modify: `index.tsx:18733-18736`

- [ ] **Step 1: Replace the existing single Text element with title + subtitle**

In `index.tsx`, find the `<View style={{ gap: 14 }}>` block inside `disconnectChoiceModal` (around line 18733).

Replace this:

```tsx
        <View style={{ gap: 14 }}>
          <Text style={{ color: '#E5E7EB', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 }}>
            {`${disconnectChoice.playerName} ${locale === 'he' ? 'התנתק/ה מהמשחק' : 'disconnected'}`}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
```

With this:

```tsx
        <View style={{ gap: 14 }}>
          <Text style={{ color: '#F9FAFB', fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 24 }}>
            {locale === 'he' ? 'היריב עזב את המשחק' : 'Your opponent left'}
          </Text>
          <Text style={{ color: '#D1D5DB', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 }}>
            {locale === 'he'
              ? `${disconnectChoice.playerName} יצא. בחרו כיצד להמשיך:`
              : `${disconnectChoice.playerName} left the game. Choose how to continue:`}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
```

- [ ] **Step 2: Verify the app renders correctly**

Open the app in the browser. In the dev tools or test harness, trigger a `disconnectChoice` state (or use the CelebrationMockupRoom if it has a disconnect preview). Confirm:
- Title "היריב עזב את המשחק" / "Your opponent left" shows large and bold
- Subtitle with player name shows smaller below it
- Two buttons still appear and work

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "feat: add explanation title and subtitle to disconnect choice modal"
```
