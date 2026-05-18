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

    const row = data as { loss_streak: number; is_first_game: boolean };
    if (row.loss_streak >= 3 || row.is_first_game) {
      return { difficulty: 'pity', isPity: true };
    }
  } catch (err) {
    console.warn('[ddaService] resolveBotConfig threw:', err);
  }

  return { difficulty: requestedDifficulty, isPity: false };
}

/**
 * Update the player's DDA fields after a bot game ends.
 * Only called for bot games — PvP losses don't affect bot difficulty.
 * On win: reset loss_streak to 0. On loss: atomically increment via RPC.
 * Always sets is_first_game = false (regardless of win/loss).
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
      // Atomic increment via Postgres RPC — avoids read-modify-write race under concurrency.
      // increment_loss_streak() also sets is_first_game = false.
      await supabaseAdmin.rpc('increment_loss_streak', { uid: userId });
    }
  } catch (err) {
    console.warn('[ddaService] onMatchEnd failed:', err);
  }
}
