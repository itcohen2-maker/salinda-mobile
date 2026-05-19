# Lobby Exit Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating exit button to the lobby screen that syncs tutorial coins to Supabase then closes the app.

**Architecture:** Add `onExitApp` prop to `TablesLobbyScreen`, add a floating ✕ button on the side opposite to the back button, show a local confirmation modal before exiting. The parent `OnlineTablesEntryScreen` provides the handler: `syncTutorialCoins()` → `BackHandler.exitApp()` (Android only; button hidden on iOS).

**Tech Stack:** React Native, BackHandler, existing Modal pattern, syncTutorialCoins (from useAuth.tsx), i18n he/en

---

## Files

| File | Change |
|------|--------|
| `shared/i18n/he.ts` | Add 3 i18n keys |
| `shared/i18n/en.ts` | Add 3 i18n keys |
| `src/screens/TablesLobbyScreen.tsx` | Add `onExitApp` prop, floating exit button, confirmation modal |
| `src/screens/OnlineTablesEntryScreen.tsx` | Import BackHandler + syncTutorialCoins, pass `onExitApp` |

---

### Task 1: Add i18n keys (he + en)

**Files:**
- Modify: `shared/i18n/he.ts`
- Modify: `shared/i18n/en.ts`

- [ ] **Step 1: Add Hebrew keys after `'lobby.yourName'` line (~159)**

In `shared/i18n/he.ts`, after the line `'lobby.yourName': 'השם שלך',` add:

```typescript
  'lobby.exitApp': 'יציאה',
  'lobby.exitAppConfirmTitle': 'יציאה מהאפליקציה',
  'lobby.exitAppConfirmBody': 'האם אתה בטוח שברצונך לצאת?',
```

- [ ] **Step 2: Add English keys after `'lobby.yourName'` line (~147)**

In `shared/i18n/en.ts`, after the line `'lobby.yourName': 'Your name',` add:

```typescript
  'lobby.exitApp': 'Exit',
  'lobby.exitAppConfirmTitle': 'Exit App',
  'lobby.exitAppConfirmBody': 'Are you sure you want to exit?',
```

- [ ] **Step 3: Commit**

```bash
git add shared/i18n/he.ts shared/i18n/en.ts
git commit -m "feat: add lobby exit-app i18n keys (he + en)"
```

---

### Task 2: Exit button + confirmation modal in TablesLobbyScreen

**Files:**
- Modify: `src/screens/TablesLobbyScreen.tsx`

- [ ] **Step 1: Add `onExitApp` to the props interface**

In `TablesLobbyScreenProps` interface, add:
```typescript
  onExitApp?: () => void;
```

- [ ] **Step 2: Destructure the new prop in the component**

In the function signature destructuring (around line 592), add `onExitApp` alongside the existing props.

- [ ] **Step 3: Add local state for the confirm modal**

After the existing `useState` calls in the component body, add:
```typescript
const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
```

- [ ] **Step 4: Add the floating exit button (rendered alongside the back button block)**

After the closing brace of the `{onBack ? (...) : null}` block, add:

```tsx
{onExitApp && Platform.OS !== 'ios' ? (
  <TouchableOpacity
    testID="lobby-exit-app"
    style={[
      styles.floatingBackBtn,
      Platform.OS === 'android' ? styles.floatingExitBtnAndroid : styles.floatingExitBtnDefault,
      { top: Math.max(safeTop + 8, 12) },
    ]}
    onPress={() => setExitConfirmVisible(true)}
    activeOpacity={0.85}
  >
    <Text style={styles.floatingBackBtnText}>✕</Text>
  </TouchableOpacity>
) : null}
```

- [ ] **Step 5: Add position styles for the exit button**

In the `StyleSheet.create({...})` block, after `floatingBackBtnAndroid` / `floatingBackBtnDefault` entries, add:

```typescript
  floatingExitBtnDefault: {
    right: 12,
  },
  floatingExitBtnAndroid: {
    left: 12,
  },
```

- [ ] **Step 6: Add the confirmation modal**

Before the closing `</ImageBackground>` tag, add:

```tsx
<Modal
  visible={exitConfirmVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setExitConfirmVisible(false)}
>
  <View style={styles.exitModalBackdrop}>
    <View style={styles.exitModalCard}>
      <Text style={styles.exitModalTitle}>{t('lobby.exitAppConfirmTitle')}</Text>
      <Text style={styles.exitModalBody}>{t('lobby.exitAppConfirmBody')}</Text>
      <View style={styles.exitModalButtons}>
        <TouchableOpacity
          style={[styles.exitModalBtn, styles.exitModalBtnConfirm]}
          onPress={() => {
            setExitConfirmVisible(false);
            onExitApp?.();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.exitModalBtnConfirmText}>{t('lobby.exitApp')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exitModalBtn, styles.exitModalBtnCancel]}
          onPress={() => setExitConfirmVisible(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.exitModalBtnCancelText}>{t('ui.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

- [ ] **Step 7: Add modal styles**

In `StyleSheet.create({...})`, add:

```typescript
  exitModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitModalCard: {
    backgroundColor: '#1a1510',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,210,122,0.3)',
    padding: 24,
    marginHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  exitModalTitle: {
    color: '#f5d27a',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  exitModalBody: {
    color: '#f5f1e6',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  exitModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  exitModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  exitModalBtnConfirm: {
    backgroundColor: '#c0392b',
  },
  exitModalBtnConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  exitModalBtnCancel: {
    backgroundColor: 'rgba(245,210,122,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,210,122,0.3)',
  },
  exitModalBtnCancelText: {
    color: '#f5d27a',
    fontWeight: '600',
    fontSize: 15,
  },
```

- [ ] **Step 8: Commit**

```bash
git add src/screens/TablesLobbyScreen.tsx
git commit -m "feat: add exit button + confirm modal to lobby screen"
```

---

### Task 3: Wire up exit handler in OnlineTablesEntryScreen

**Files:**
- Modify: `src/screens/OnlineTablesEntryScreen.tsx`

- [ ] **Step 1: Add BackHandler import**

In the React Native import block at the top, add `BackHandler`:
```typescript
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  ...
} from 'react-native';
```

- [ ] **Step 2: Import syncTutorialCoins**

Change the `useAuth` import line to also import `syncTutorialCoins`:
```typescript
import { useAuth, syncTutorialCoins } from '../hooks/useAuth';
```

- [ ] **Step 3: Add handleExitApp function inside the component**

After the existing handler functions (e.g., `handleQuickMatch`), add:
```typescript
const handleExitApp = async () => {
  await syncTutorialCoins();
  BackHandler.exitApp();
};
```

- [ ] **Step 4: Pass onExitApp to TablesLobbyScreen**

In the `<TablesLobbyScreen ... />` JSX, add:
```tsx
onExitApp={handleExitApp}
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/OnlineTablesEntryScreen.tsx
git commit -m "feat: wire exit-app handler — sync tutorial coins then close app"
```

---

### Task 4: Verify i18n key `ui.cancel` exists

**Files:**
- Check: `shared/i18n/he.ts`, `shared/i18n/en.ts`

- [ ] **Step 1: Grep for ui.cancel**

```bash
grep -n "ui.cancel" shared/i18n/he.ts shared/i18n/en.ts
```

Expected: both files have `'ui.cancel'`. If missing, add `'ui.cancel': 'ביטול'` to he.ts and `'ui.cancel': 'Cancel'` to en.ts and commit.
