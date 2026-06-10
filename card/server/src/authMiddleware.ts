// ============================================================
// authMiddleware.ts - Socket.io middleware that verifies the
// Supabase JWT sent in the handshake and marks whether this is a
// registered (non-anonymous) account. Unauthenticated sockets can still
// connect for open reads, but protected online game actions are blocked.
// ============================================================

import type { Socket } from 'socket.io';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * Closed invite gate: an account may perform online actions only if it is
 * an admin OR its email is on the invited_users allowlist with status
 * 'invited'. This mirrors the client-side gate so a blocked / non-invited
 * user can't act even if it bypasses the front-end. Fails closed: any
 * lookup error blocks the action rather than granting it.
 */
async function isInvited(userId: string, email: string | null): Promise<boolean> {
  if (!supabaseAdmin) return false;

  try {
    // Admins always pass — they can never be locked out.
    const { data: adminRow } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (adminRow?.user_id) return true;

    if (!email) return false;

    const { data, error } = await supabaseAdmin
      .from('invited_users')
      .select('status')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) return false;
    return data?.status === 'invited';
  } catch {
    return false;
  }
}

/**
 * Socket.io middleware - runs once per connection.
 * Reads `socket.handshake.auth.token`, verifies it with Supabase,
 * and sets `socket.data.userId` only for non-anonymous accounts that
 * also pass the closed invite gate.
 */
export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const markGuest = () => {
    socket.data.userId = null;
    socket.data.userEmail = null;
    socket.data.isRegisteredUser = false;
  };

  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    markGuest();
    return next();
  }

  if (!supabaseAdmin) {
    if (process.env.NODE_ENV !== 'production') {
      socket.data.userId = `dev:${token.slice(0, 24)}`;
      socket.data.userEmail = null;
      socket.data.isRegisteredUser = true;
      return next();
    }
    markGuest();
    return next();
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.warn('[auth] JWT verify failed:', error?.message ?? 'no user');
      markGuest();
      return next();
    }

    const isAnonymous = (user as { is_anonymous?: boolean }).is_anonymous === true;
    if (isAnonymous) {
      markGuest();
      return next();
    }

    // Closed invite gate — only allowlisted (or admin) emails may act.
    const invited = await isInvited(user.id, user.email ?? null);
    if (!invited) {
      console.warn('[auth] blocked non-invited account:', user.email ?? user.id);
      markGuest();
      return next();
    }

    socket.data.userId = user.id;
    socket.data.userEmail = user.email;
    socket.data.isRegisteredUser = true;
    return next();
  } catch (err) {
    console.error('[auth] middleware exception:', err);
    markGuest();
    return next();
  }
}
