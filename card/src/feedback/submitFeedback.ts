import type { User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { PlayerProfile } from '../hooks/useAuth';
import { LAST_PUSH } from '../buildInfo';
import { supabase } from '../lib/supabase';
import type { FeedbackExperienceKind } from './promptState';

export type FeedbackSubmitResult = 'submitted' | 'error';

interface SubmitFeedbackArgs {
  comment: string;
  kind: FeedbackExperienceKind;
  locale: string;
  profile: PlayerProfile | null;
  rating: number;
  user: User | null;
}

function resolveAppVersion(): string | null {
  const appVersion = Constants.expoConfig?.version;
  const base = typeof appVersion === 'string' && appVersion.trim().length > 0
    ? appVersion.trim()
    : null;
  return base ? `${base} (${LAST_PUSH})` : LAST_PUSH || null;
}

function resolveUsernameSnapshot(user: User | null, profile: PlayerProfile | null): string | null {
  const profileUsername = profile?.username?.trim();
  if (profileUsername) return profileUsername;

  const metadataUsername = user?.user_metadata?.username;
  return typeof metadataUsername === 'string' && metadataUsername.trim().length > 0
    ? metadataUsername.trim()
    : null;
}

export async function submitFeedback({
  comment,
  kind,
  locale,
  profile,
  rating,
  user,
}: SubmitFeedbackArgs): Promise<FeedbackSubmitResult> {
  if (!user?.id) return 'error';
  if (!Number.isFinite(rating)) return 'error';

  const normalizedRating = Math.max(1, Math.min(5, Math.round(rating)));
  const normalizedComment = comment.trim();
  const isAnonymous = user.is_anonymous === true;
  const localeSnapshot = locale.trim() || 'en';

  try {
    const { error } = await supabase
      .from('feedback_submissions')
      .insert({
        app_version: resolveAppVersion(),
        comment: normalizedComment,
        email_snapshot: !isAnonymous && user.email ? user.email : null,
        experience_kind: kind,
        is_anonymous: isAnonymous,
        locale: localeSnapshot,
        platform: Platform.OS,
        rating: normalizedRating,
        user_id: user.id,
        username_snapshot: resolveUsernameSnapshot(user, profile),
      });

    return error ? 'error' : 'submitted';
  } catch {
    return 'error';
  }
}
