# Visitor Analytics & Anonymous Feedback — Design

**Date:** 2026-05-26  
**Status:** Approved

## Overview

Track every visitor (anonymous and registered) across all platforms (Android, iOS, Web) using Supabase. Build an in-app analytics dashboard for admins. Allow anonymous users to submit feedback. Fix the feedback inbox reviewed/archived bug. Automate mobile OTA updates on every push.

---

## Part 1: Data Model

### New table: `app_sessions`

One row per app session (open → background/close).

```sql
id             uuid PK default gen_random_uuid()
user_id        uuid references auth.users(id) on delete set null
is_anonymous   boolean not null
platform       text not null  -- 'ios' | 'android' | 'web'
locale         text not null
app_version    text
session_start  timestamptz not null default now()
last_seen_at   timestamptz not null default now()
session_end    timestamptz  -- null if still active
event_count    int not null default 0
```

`last_seen_at` is updated every ~30 seconds while the app is active. If `session_end` is null, `last_seen_at` is used as the estimated end time.

### New table: `app_events`

One row per tracked action within a session.

```sql
id           uuid PK default gen_random_uuid()
session_id   uuid not null references app_sessions(id) on delete cascade
user_id      uuid references auth.users(id) on delete set null
event_type   text not null
event_data   jsonb not null default '{}'
created_at   timestamptz not null default now()
```

### Tracked event types

| event_type | Trigger | event_data |
|---|---|---|
| `app_open` | Every app open | `{ is_returning: boolean }` |
| `tutorial_lesson_complete` | Each tutorial lesson finished | `{ lesson_index: number }` |
| `tutorial_complete` | Full tutorial completed | `{}` |
| `game_played` | Game ends | `{ won: boolean, mode: 'local' \| 'online' \| 'bot' }` |
| `feedback_submitted` | Feedback sent | `{ rating: number, kind: string }` |
| `user_registered` | Anonymous user completes registration | `{}` |

### RLS policies

- **`app_sessions` insert/update**: `authenticated` users may only write their own row (`user_id = auth.uid()`)
- **`app_events` insert**: `authenticated` users may only write rows where `user_id = auth.uid()`
- **Read**: admin only (same pattern as `feedback_submissions`)

### Bug fix: apply missing migrations

Migrations `020_feedback_admin_write.sql` and `021_feedback_admin_delete.sql` were written but not applied to production Supabase. Apply them via the Supabase SQL editor. This restores the "mark reviewed" and "archive" actions in the feedback inbox.

---

## Part 2: Anonymous Auth + Session Lifecycle

### Anonymous auth on first open

On every app open, `useAuth` checks:
- If a Supabase session already exists → use it.
- If no session exists → call `supabase.auth.signInAnonymously()`.

This means every visitor — even someone who never registers — has a `user_id` from the first second.

### When a user registers

Supabase supports linking an anonymous user to a real account via `supabase.auth.linkIdentity()` or the sign-up flow with `updateUser`. The `user_id` stays the same, so all historical sessions and events remain associated with the now-registered user. The `is_anonymous` flag flips to `false`. A `user_registered` event is emitted at this moment.

### Session lifecycle

```
app opens
  → ensure auth session (anon or real)
  → insert row into app_sessions
  → emit app_open event

app active
  → update last_seen_at every 30s
  → emit events as actions happen

app goes to background / closes (AppState on mobile, visibilitychange on web)
  → update session_end + last_seen_at
```

A new session row is created on every cold start. Returning from background within 60 seconds resumes the same session (no new row).

### Implementation: `useSessionTracking` hook

New hook at `src/hooks/useSessionTracking.ts`. Called once at the top level of the app (inside the auth provider). Responsibilities:
- Calls `signInAnonymously()` if needed
- Inserts `app_sessions` row on mount
- Manages `AppState` / `visibilitychange` listener for session_end
- Exports `trackEvent(type, data)` function used by the rest of the app
- Updates `last_seen_at` on a 30s interval while active

---

## Part 3: Anonymous Feedback

Currently `submitFeedback` returns early if `!user?.id`. Since all users now have anonymous auth, this condition is always satisfied — no code change needed in the guard itself.

The INSERT policy on `feedback_submissions` already allows any `authenticated` user. The only change: anonymous users will have `is_anonymous: true` and `username_snapshot: null`. The feedback inbox already handles and displays this correctly.

---

## Part 4: Analytics Admin Screen

New screen: `AnalyticsScreen` (`src/screens/AnalyticsScreen.tsx`). Accessible from the same admin entry point as the feedback inbox.

### Summary row (top)

Four stat chips:
- **Today** — unique sessions today
- **Week** — unique sessions this week  
- **Avg. duration** — average `session_end - session_start` across completed sessions
- **Conversion** — % of sessions where `user_registered` event exists

### Filter bar

- Platform: All / Android / iOS / Web
- User type: All / Anonymous / Registered
- Period: Today / 7 days / 30 days

### Session list (below)

Each row shows:
- Platform badge (colored: green=Android, blue=iOS, purple=Web)
- Username or "אנונימי"
- Date + time
- Session duration (mm:ss or hh:mm)
- Event breadcrumb: small icons/labels for events in the session (e.g. `📖 L3` `🎮 won` `💬`)

Tapping a session row expands it to show the full event list with timestamps.

### Data loading

Same pattern as `FeedbackInboxScreen`:
- `useFeedbackAdmin` (reuse — same admin flag)
- Load sessions with a join on `app_events` (or load events separately per session on expand)
- Limit 200 rows per load, newest first by default

---

## Part 5: Mobile OTA Updates on Every Push

Update the pre-push hook at `.git/hooks/pre-push`:

After updating `buildInfo.ts` and amending the commit, add:

```bash
# Push OTA update to all mobile channels
eas update --channel production --non-interactive --message "push $(date)"
```

This means every `git push`:
1. Updates `LAST_PUSH` timestamp in `buildInfo.ts` ✓
2. Amends commit with the timestamp ✓
3. Triggers EAS Update → mobile apps get the new JS bundle OTA ✓
4. Vercel picks up the push → web rebuilds ✓

All four platforms (Android, iOS, Web) are current within minutes of every push.

---

## Summary of Changes

| Area | File(s) | Type |
|---|---|---|
| Supabase migrations | `supabase/migrations/022_app_sessions.sql`, `023_app_events.sql` | New |
| Supabase fix | Apply 020 + 021 via SQL editor | Fix |
| Anonymous auth | `src/hooks/useAuth.ts` | Modify |
| Session tracking | `src/hooks/useSessionTracking.ts` | New |
| Event tracking | `index.tsx`, tutorial + game completion points | Modify |
| Anonymous feedback | No code change needed (auth handles it) | — |
| Analytics screen | `src/screens/AnalyticsScreen.tsx` | New |
| Admin navigation | `index.tsx` or lobby admin entry point | Modify |
| Pre-push hook | `.git/hooks/pre-push` | Modify |
