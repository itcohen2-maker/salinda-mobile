import type { BotDifficulty } from '../../shared/types';
import { supabaseAdmin } from './supabaseAdmin';

export type ResolvedBotConfig = {
  difficulty: BotDifficulty;
  isPity: boolean;
};

/**
 * Check the player's DDA state and decide whether to override the requested
 * difficulty with 'pity'. Guests (userId = null) bypass all checks.
 * Falls back to requestedDifficulty on any Supabase error.
 */
export async function resolveBotConfig(
  userId: string | null,
  requestedDifficulty: BotDifficulty,
): Promise<ResolvedBotConfig> {
  if (!userId || !supabaseAdmin) {
    return { difficulty: requestedDifficulty, isPity: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('loss_streak, is_first_game')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn('[ddaService] resolveBotConfig fetch failed:', error?.message);
      return { difficulty: requestedDifficulty, isPity: false };
    }

    const shouldPity = (data as { loss_streak: number; is_first_game: boolean }).loss_streak >= 3
      || (data as { loss_streak: number; is_first_game: boolean }).is_first_game;

    if (shouldPity) {
      return { difficulty: 'pity', isPity: true };
    }
  } catch (err) {
    console.warn('[ddaService] resolveBotConfig threw:', err);
  }

  return { difficulty: requestedDifficulty, isPity: false };
}

/**
 * Update the player's DDA fields after a match ends.
 * On win: reset loss_streak to 0. On loss: increment loss_streak.
 * Always sets is_first_game = false.
 * Uses read-then-write for increment (Supabase JS v2 lacks server-side col+1).
 * Safe: protected by room.matchRecorded idempotency guard upstream.
 */
export async function onMatchEnd(userId: string, didWin: boolean): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    if (didWin) {
      await supabaseAdmin
        .from('profiles')
        .update({ loss_streak: 0, is_first_game: false })
        .eq('id', userId);
    } else {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('loss_streak')
        .eq('id', userId)
        .single();
      const current = (data as { loss_streak: number } | null)?.loss_streak ?? 0;
      await supabaseAdmin
        .from('profiles')
        .update({ loss_streak: current + 1, is_first_game: false })
        .eq('id', userId);
    }
  } catch (err) {
    console.warn('[ddaService] onMatchEnd failed:', err);
  }
}
