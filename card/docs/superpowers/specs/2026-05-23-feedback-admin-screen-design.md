# Feedback Admin Screen — Design Spec
**Date:** 2026-05-23

## Overview

An in-app admin screen for browsing, triaging, and archiving user feedback submissions. Accessible via a button inside the existing feedback dialog, visible only to users in the `admin_users` table.

Data is never physically deleted — archiving sets `status = 'archived'` so submissions are preserved for future insight/analysis.

---

## Architecture

### New files
| Path | Purpose |
|------|---------|
| `src/admin/feedbackAdmin.ts` | Supabase queries: fetch by status, update status |
| `src/screens/AdminFeedbackScreen.tsx` | Main admin screen UI |
| `supabase/migrations/020_feedback_admin_write.sql` | Grants UPDATE on `feedback_submissions` to admin users |

### Existing files touched
| Path | Change |
|------|--------|
| Feedback dialog / button component | Add "פתח תיבת נכנסת" button, shown only when `isAdmin === true` |
| Navigation / index.tsx | Wire `AdminFeedbackScreen` into the screen stack |

---

## Database Migration (`020`)

Add a Supabase RLS policy that allows admin users to UPDATE any row in `feedback_submissions`:

```sql
create policy "Admins update feedback submissions"
  on public.feedback_submissions
  for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

grant update on public.feedback_submissions to authenticated;
```

No DELETE policy — soft-delete only via status field.

---

## Data Layer (`feedbackAdmin.ts`)

```typescript
// Fetch all submissions for a given status, newest first (default) or oldest first
fetchFeedback(status: FeedbackStatus, ascending: boolean): Promise<FeedbackSubmission[]>

// Move a submission to a new status
updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void>

type FeedbackStatus = 'new' | 'reviewed' | 'archived'
```

Fields returned per submission: `id`, `username_snapshot`, `email_snapshot`, `is_anonymous`, `locale`, `experience_kind`, `rating`, `comment`, `platform`, `app_version`, `status`, `created_at`.

---

## UI (`AdminFeedbackScreen.tsx`)

### Layout
- Header: title "פידבקים" + כפתור חזרה
- 3 tabs: **חדש** / **נסקר** / **ארכיון**
- Sort toggle button (↑↓) in header — flips date order within the active tab
- Scrollable list of feedback cards

### Feedback card
```
[⭐⭐⭐⭐☆]  game · iOS · 2026-05-23
יוסי כהן
"הייתה לי חוויה מצוינת במשחק..."

[סמן כנסקר]  [ארכיון]     ← shown in "חדש" tab
             [ארכיון]     ← shown in "נסקר" tab
                          ← no buttons in "ארכיון" tab
```

### States
- **Loading**: spinner centered
- **Empty**: "אין פידבקים בקטגוריה זו"
- **Error**: banner with retry button
- **No admin access**: full-screen "אין גישה" (same pattern as AdminCoinGiftsScreen)

### Behavior
- Tab switch reloads the list for that status
- Status update optimistically removes card from current tab, reloads if error
- Sort toggle re-fetches with `ascending` flipped

---

## Entry Point

Inside the existing feedback dialog/button, add:

```tsx
{isAdmin && (
  <TouchableOpacity onPress={openFeedbackAdmin}>
    <Text>תיבת נכנסת</Text>
  </TouchableOpacity>
)}
```

`isAdmin` comes from the existing `useAdminAccess()` hook.

---

## Out of Scope
- CSV export (future, when enough data)
- Filtering by experience_kind or rating
- Pagination (load all for now; add when list grows large)
- Push notifications for new feedback
