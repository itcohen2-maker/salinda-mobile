# Web Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain the web app to a 412px centered column so it looks like a mobile device in the browser, with an optional 160×600 ad slot to the right.

**Architecture:** Three changes: (1) cap `viewportWidth` in `getWebGameLayout` so layout math uses container width not browser width, (2) create a thin `AdSlot` component for web-only ad placeholders, (3) wrap `AppShell` content in a centering column when `Platform.OS === 'web'`.

**Tech Stack:** React Native Web, TypeScript, Expo

---

### Task 1: Cap `viewportWidth` in `getWebGameLayout`

**Files:**
- Modify: `src/theme/webLayout.ts:52-54`
- Test: `src/theme/webLayout.test.ts`

- [ ] **Step 1: Read current test expectations**

Open `src/theme/webLayout.test.ts` and note the wide-viewport test cases (width: 1366, 1440, 1920, 768). These all check `layout.playfieldWidth === WEB_GAME_PLAYFIELD_MAX_WIDTH` (412). None check `layout.viewportWidth` directly, so no test changes are needed.

- [ ] **Step 2: Update `getWebGameLayout` to cap `viewportWidth`**

In `src/theme/webLayout.ts`, replace lines 52-55:

```typescript
// Before:
export function getWebGameLayout(viewport: ViewportSize): WebGameLayout {
  const viewportWidth = Math.max(320, Math.round(viewport.width || 0));
  const viewportHeight = Math.max(568, Math.round(viewport.height || 0));
  const playfieldWidth = Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, viewportWidth);
```

```typescript
// After:
export function getWebGameLayout(viewport: ViewportSize): WebGameLayout {
  const viewportWidth = Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, Math.max(320, Math.round(viewport.width || 0)));
  const viewportHeight = Math.max(568, Math.round(viewport.height || 0));
  const playfieldWidth = viewportWidth;
```

- [ ] **Step 3: Run the layout tests**

```bash
npx jest src/theme/webLayout.test.ts --no-coverage
```

Expected: all tests PASS. (The clamped values for tableHeight, tableTop, etc. are based on `viewportHeight` and `playfieldWidth`, neither of which changed for narrow viewports. For wide viewports, `playfieldWidth` was already 412 and remains 412.)

- [ ] **Step 4: Commit**

```bash
git add src/theme/webLayout.ts
git commit -m "fix: cap viewportWidth to WEB_GAME_PLAYFIELD_MAX_WIDTH in getWebGameLayout"
```

---

### Task 2: Create `AdSlot` component

**Files:**
- Create: `src/components/AdSlot.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AdSlot.tsx`:

```typescript
import React from 'react';
import { Platform, View, Text } from 'react-native';

type AdSlotProps = {
  slot: 'skyscraper' | 'leaderboard';
  visible?: boolean;
};

const SIZES: Record<string, { width: number; height: number }> = {
  skyscraper: { width: 160, height: 600 },
  leaderboard: { width: 728, height: 90 },
};

export function AdSlot({ slot, visible = true }: AdSlotProps) {
  if (Platform.OS !== 'web' || !visible) return null;
  const { width, height } = SIZES[slot];
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: '#0a1628',
        borderColor: '#1e293b',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Text style={{ color: '#1e3a5f', fontSize: 10, letterSpacing: 1 }}>AD</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `AdSlot.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdSlot.tsx
git commit -m "feat: add AdSlot placeholder component for web ad slots"
```

---

### Task 3: Wrap `AppShell` in centering column (web only)

**Files:**
- Modify: `index.tsx` — `AppShell` function (around line 17716)

- [ ] **Step 1: Add `useWebViewportSize` call and `AdSlot` import to `AppShell`**

`useWebViewportSize` is already imported at the top of `index.tsx` (line 97). Add the `AdSlot` import near the other component imports (around line 38-41):

```typescript
import { AdSlot } from './src/components/AdSlot';
```

- [ ] **Step 2: Replace the `AppShell` return statement**

Find `AppShell` function (line ~17716). The current return is a single `<View>` with `flex:1`. Replace it with a web-aware version:

```typescript
function AppShell({ showSplash, setShowSplash }: { showSplash: boolean; setShowSplash: (v: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [activePlayMode, setActivePlayMode] = useState<ShellPlayMode>('choose');
  const viewport = useWebViewportSize();
  const showAds = Platform.OS === 'web' && viewport.width >= 768;

  useEffect(() => {
    sendDebugLog('H3', 'index.tsx:AppShell.useEffect', 'AppShell mounted', {
      insetTop: insets.top,
      insetBottom: insets.bottom,
      showSplash,
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const applyNavBarTheme = () => {
      void SystemUI.setBackgroundColorAsync('#0a1628').catch(() => {});
      NavigationBar.setBackgroundColorAsync('#0a1628').catch(() => {});
      NavigationBar.setButtonStyleAsync('light').catch(() => {});
      NavigationBar.setBorderColorAsync('#0a1628').catch(() => {});
    };
    applyNavBarTheme();
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') applyNavBarTheme();
    });
    const t1 = setTimeout(applyNavBarTheme, 250);
    const t2 = setTimeout(applyNavBarTheme, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      appStateSub.remove();
    };
  }, []);

  const gameContent = (
    <>
      <StatusBar style="light" />
      <AmbientBackground playMode={activePlayMode} />
      <GameRouter onPlayModeChange={setActivePlayMode} />
      <NotificationZone />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </>
  );

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0a1628',
          paddingTop: insets.top,
          paddingBottom: 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        {gameContent}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1628', flexDirection: 'column' }}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
        <View style={{ flex: 1, maxWidth: WEB_GAME_PLAYFIELD_MAX_WIDTH, backgroundColor: '#0a1628' }}>
          {gameContent}
        </View>
        <AdSlot slot="skyscraper" visible={showAds} />
      </View>
    </View>
  );
}
```

Note: `WEB_GAME_PLAYFIELD_MAX_WIDTH` is imported from `./src/theme/webLayout` (check the existing import at the top of `index.tsx`).

- [ ] **Step 3: Add `WEB_GAME_PLAYFIELD_MAX_WIDTH` to the webLayout import**

Line 96 of `index.tsx` currently reads:
```typescript
import { clamp, getWebGameLayout } from './src/theme/webLayout';
```

Change it to:
```typescript
import { clamp, getWebGameLayout, WEB_GAME_PLAYFIELD_MAX_WIDTH } from './src/theme/webLayout';
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Run unit tests**

```bash
npx jest --testPathPattern="webLayout|slinda-reducer|botBrain" --no-coverage 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 6: Start the web dev server and verify visually**

```bash
npx expo start --web
```

Open browser, resize to various widths:
- Wide (1280px+): game column 412px centered, dark sides, ad slot visible on right
- Medium (768px–1279px): game column 412px centered, dark sides, ad slot visible
- Narrow (<412px): game fills full width, no ad slot

- [ ] **Step 7: Commit**

```bash
git add index.tsx
git commit -m "feat: center web app in 412px column with ad slot"
```
