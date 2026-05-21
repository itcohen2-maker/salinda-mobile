import { supabase } from '../lib/supabase';

export interface AdminCoinGiftTarget {
  id: string;
  totalCoins: number;
  username: string;
}

export type GrantAdminCoinsResult =
  | { status: 'ok'; nextBalance: number; target: AdminCoinGiftTarget }
  | { status: 'forbidden' | 'invalid_amount' | 'target_not_found' | 'error' };

function normalizeCoins(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export async function findAdminCoinGiftTarget(username: string): Promise<AdminCoinGiftTarget | null | 'error'> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, total_coins')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (error) return 'error';
    if (!data?.id || typeof data.username !== 'string') return null;

    return {
      id: data.id,
      totalCoins: normalizeCoins((data as { total_coins?: unknown }).total_coins),
      username: data.username,
    };
  } catch {
    return 'error';
  }
}

export async function grantAdminCoins(args: {
  amount: number;
  reason: string;
  username: string;
}): Promise<GrantAdminCoinsResult> {
  const normalizedAmount = Math.floor(Number(args.amount) || 0);
  if (normalizedAmount <= 0) return { status: 'invalid_amount' };

  const target = await findAdminCoinGiftTarget(args.username);
  if (target === 'error') return { status: 'error' };
  if (!target) return { status: 'target_not_found' };

  try {
    const { data, error } = await supabase.rpc('admin_grant_coins', {
      p_amount: normalizedAmount,
      p_reason: args.reason.trim(),
      p_target_user_id: target.id,
    });

    if (error) return { status: 'error' };

    const rpcStatus = typeof data === 'string' ? data : 'error';
    if (rpcStatus === 'ok') {
      return {
        status: 'ok',
        nextBalance: target.totalCoins + normalizedAmount,
        target,
      };
    }
    if (rpcStatus === 'forbidden' || rpcStatus === 'invalid_amount' || rpcStatus === 'target_not_found') {
      return { status: rpcStatus };
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}
