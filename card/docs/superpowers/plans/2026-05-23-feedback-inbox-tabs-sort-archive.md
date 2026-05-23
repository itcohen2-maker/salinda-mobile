# Feedback Inbox — Tabs, Sort & Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `FeedbackInboxScreen` with 3 status tabs (new / reviewed / archived), a date sort toggle, and per-card action buttons (mark-as-reviewed, archive) backed by a Supabase UPDATE policy for admins.

**Architecture:** Three small changes — (1) a DB migration that unlocks admin UPDATE on `feedback_submissions`; (2) two i18n files get new keys; (3) `FeedbackInboxScreen.tsx` gains tab state, sort state, per-tab fetch, and action buttons. No new files needed.

**Tech Stack:** React Native, Supabase JS v2, existing `useLocale` / `useFeedbackAdmin` / `useAuth` hooks, StyleSheet.

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/020_feedback_admin_write.sql` | CREATE — add UPDATE policy for admins |
| `shared/i18n/he.ts` | MODIFY — add 5 new feedbackInbox keys |
| `shared/i18n/en.ts` | MODIFY — add 5 new feedbackInbox keys |
| `src/screens/FeedbackInboxScreen.tsx` | MODIFY — add tabs, sort, action buttons |

---

### Task 1: DB migration — admin UPDATE access

**Files:**
- Create: `supabase/migrations/020_feedback_admin_write.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- 020_feedback_admin_write.sql
-- Allows admin users to update the status of any feedback
-- submission (soft-archive workflow — no physical deletes).
-- ============================================================

create policy "Admins update feedback submissions"
  on public.feedback_submissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant update (status) on public.feedback_submissions to authenticated;
```

- [ ] **Step 2: Apply migration to local Supabase (if running locally)**

```bash
npx supabase db push
```

Expected: migration applied without errors. Skip if using hosted Supabase — run SQL directly in the Supabase SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_feedback_admin_write.sql
git commit -m "feat: allow admins to update feedback submission status"
```

---

### Task 2: i18n keys for new UI

**Files:**
- Modify: `shared/i18n/he.ts`
- Modify: `shared/i18n/en.ts`

- [ ] **Step 1: Add keys to Hebrew i18n file**

After the line `'feedbackInbox.status.archived': 'בארכיון',` in `shared/i18n/he.ts`, add:

```typescript
  'feedbackInbox.sortNewest': 'חדש ראשון',
  'feedbackInbox.sortOldest': 'ישן ראשון',
  'feedbackInbox.markReviewed': 'סמן כנסקר',
  'feedbackInbox.archive': 'ארכיון',
  'feedbackInbox.actionError': 'לא הצלחנו לעדכן את הסטטוס. נסה שוב.',
```

- [ ] **Step 2: Add keys to English i18n file**

After the line `'feedbackInbox.status.archived': 'Archived',` in `shared/i18n/en.ts`, add:

```typescript
  'feedbackInbox.sortNewest': 'Newest first',
  'feedbackInbox.sortOldest': 'Oldest first',
  'feedbackInbox.markReviewed': 'Mark reviewed',
  'feedbackInbox.archive': 'Archive',
  'feedbackInbox.actionError': 'Could not update status. Try again.',
```

- [ ] **Step 3: Commit**

```bash
git add shared/i18n/he.ts shared/i18n/en.ts
git commit -m "feat: add feedbackInbox i18n keys for tabs/sort/actions"
```

---

### Task 3: Update FeedbackInboxScreen — tabs, sort, action buttons

**Files:**
- Modify: `src/screens/FeedbackInboxScreen.tsx`

**Overview of changes:**
- Add `activeTab` state (`'new' | 'reviewed' | 'archived'`, default `'new'`)
- Add `ascending` sort state (default `false` = newest first)
- Add `actionError` banner state
- Change `loadFeedbackItems` to filter by `activeTab` and sort by `ascending`
- Re-run load when `activeTab` or `ascending` changes
- Add `handleUpdateStatus(id, newStatus)` — calls supabase UPDATE, optimistically removes card
- Add tab bar, sort toggle button, action buttons to card, action error banner

- [ ] **Step 1: Replace the state declarations and `loadFeedbackItems` in `FeedbackInboxScreen`**

Replace the block from `const [feedbackItems, ...]` through the end of `loadFeedbackItems` (lines 60–98) with:

```typescript
  const [activeTab, setActiveTab] = useState<FeedbackSubmissionStatus>('new');
  const [ascending, setAscending] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedFeedbackId, setCopiedFeedbackId] = useState<string | null>(null);
  const copiedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFeedbackItems = useCallback(async () => {
    if (!user?.id || !isFeedbackAdmin) {
      setFeedbackItems([]);
      setHasError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);
    setActionError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('feedback_submissions')
        .select(
          'id, username_snapshot, is_anonymous, locale, experience_kind, rating, comment, platform, app_version, status, created_at',
        )
        .eq('status', activeTab)
        .order('created_at', { ascending })
        .limit(200);

      if (queryError) {
        setFeedbackItems([]);
        setHasError(true);
        return;
      }

      setFeedbackItems(Array.isArray(data) ? (data as FeedbackSubmissionRow[]) : []);
    } catch {
      setFeedbackItems([]);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [isFeedbackAdmin, user?.id, activeTab, ascending]);
```

- [ ] **Step 2: Update the useEffect that triggers load to also depend on `activeTab` and `ascending`**

The existing effect (line 100–102) already uses `loadFeedbackItems` as dependency, which now includes `activeTab` and `ascending` — no change needed. Verify it reads:

```typescript
  useEffect(() => {
    void loadFeedbackItems();
  }, [loadFeedbackItems]);
```

- [ ] **Step 3: Add `handleUpdateStatus` function after the `handleCopyUsername` callback**

```typescript
  const handleUpdateStatus = useCallback(async (id: string, newStatus: FeedbackSubmissionStatus) => {
    setFeedbackItems((prev) => prev.filter((item) => item.id !== id));
    setActionError(null);
    try {
      const { error } = await supabase
        .from('feedback_submissions')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) {
        setActionError(t('feedbackInbox.actionError'));
        void loadFeedbackItems();
      }
    } catch {
      setActionError(t('feedbackInbox.actionError'));
      void loadFeedbackItems();
    }
  }, [loadFeedbackItems, t]);
```

- [ ] **Step 4: Add tab bar and sort toggle to the header area**

Replace the existing `<Text style={styles.subtitle}>` line with:

```tsx
      {/* Tab bar */}
      <View style={[styles.tabBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(['new', 'reviewed', 'archived'] as FeedbackSubmissionStatus[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
              {t(`feedbackInbox.status.${tab}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort toggle */}
      <TouchableOpacity
        onPress={() => setAscending((prev) => !prev)}
        style={[styles.sortToggle, { alignSelf: isRTL ? 'flex-start' : 'flex-end' }]}
      >
        <Text style={styles.sortToggleText}>
          {ascending ? t('feedbackInbox.sortOldest') : t('feedbackInbox.sortNewest')} ↕
        </Text>
      </TouchableOpacity>

      {/* Action error banner */}
      {actionError ? (
        <Text style={styles.actionErrorText}>{actionError}</Text>
      ) : null}
```

- [ ] **Step 5: Add action buttons to each feedback card**

Inside the `.map((item) => { ... })` block, after the closing `</Text>` of `commentText`, add action buttons before the closing `</View>` of the card:

```tsx
                  {activeTab !== 'archived' ? (
                    <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      {activeTab === 'new' ? (
                        <TouchableOpacity
                          onPress={() => void handleUpdateStatus(item.id, 'reviewed')}
                          style={styles.actionButton}
                          testID={`feedback-mark-reviewed-${item.id}`}
                        >
                          <Text style={styles.actionButtonText}>{t('feedbackInbox.markReviewed')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => void handleUpdateStatus(item.id, 'archived')}
                        style={[styles.actionButton, styles.actionButtonArchive]}
                        testID={`feedback-archive-${item.id}`}
                      >
                        <Text style={styles.actionButtonText}>{t('feedbackInbox.archive')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
```

- [ ] **Step 6: Add new styles to `StyleSheet.create`**

At the end of the existing `styles` object (before the closing `}`), add:

```typescript
  tabBar: {
    marginTop: 14,
    gap: 8,
    justifyContent: 'center',
  },
  tabButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(37,99,235,0.24)',
    borderColor: 'rgba(96,165,250,0.52)',
  },
  tabButtonText: {
    color: 'rgba(191,219,254,0.6)',
    fontSize: 12,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: '#BFDBFE',
  },
  sortToggle: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sortToggleText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  actionErrorText: {
    marginTop: 8,
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionRow: {
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  actionButtonArchive: {
    backgroundColor: 'rgba(100,116,139,0.18)',
    borderColor: 'rgba(148,163,184,0.34)',
  },
  actionButtonText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
  },
```

- [ ] **Step 7: Remove the now-unused `subtitle` Text element**

The subtitle (`t('feedbackInbox.subtitle')`) that was below the header can be removed — the tab bar replaces it visually.

- [ ] **Step 8: Commit**

```bash
git add src/screens/FeedbackInboxScreen.tsx
git commit -m "feat: feedback inbox tabs, sort toggle, and archive actions"
```

---

### Task 4: Push and verify

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Manual smoke test checklist**
  - Open app → lobby → "תיבת פידבקים" (admin button)
  - Verify 3 tabs appear: חדש / נסקר / בארכיון
  - Verify sort toggle changes order of items
  - Tap "סמן כנסקר" on a new item → card disappears from "חדש", appears in "נסקר"
  - Tap "ארכיון" on a reviewed item → card disappears from "נסקר", appears in "בארכיון"
  - Verify archived tab has no action buttons
  - Verify non-admin user sees "אין גישה" screen
