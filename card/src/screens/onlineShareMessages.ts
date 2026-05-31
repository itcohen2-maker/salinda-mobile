import type { MsgParams } from '../../shared/i18n';

type TFn = (key: string, params?: MsgParams) => string;

type ShareMessageOptions = {
  t: TFn;
  roomCode?: string | null;
  inviteCode?: string | null;
  inviteLink?: string | null;
  inviteSuffix?: string | null;
};

function compactLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

/**
 * Formats a room code for display/sharing with a Google-style "S-" prefix
 * (e.g. "1234" -> "S-1234"). The internal/stored code stays digits-only.
 */
export function formatRoomCode(code: string | null | undefined): string {
  const normalized = code?.trim();
  if (!normalized) return '';
  return `S-${normalized}`;
}

export function buildRoomShareMessage({
  t,
  roomCode,
  inviteCode,
  inviteLink,
}: ShareMessageOptions): string {
  const normalizedRoomCode = roomCode?.trim();
  const normalizedInviteCode = inviteCode?.trim();
  const normalizedInviteLink = inviteLink?.trim();

  if (!normalizedRoomCode) return '';

  return compactLines([
    t('lobby.shareInviteIntro'),
    t('lobby.shareCodeHint'),
    `${t('lobby.roomCodeLabel')}: ${formatRoomCode(normalizedRoomCode)}`,
    normalizedInviteCode ? `${t('lobby.inviteCodeLabel')}: ${normalizedInviteCode}` : null,
    normalizedInviteLink ? t('lobby.shareWebLinkHint') : null,
    normalizedInviteLink ?? null,
  ]);
}

export function buildPrivateInviteShareMessage({
  t,
  roomCode,
  inviteCode,
  inviteLink,
}: ShareMessageOptions): string {
  const normalizedRoomCode = roomCode?.trim();
  const normalizedInviteCode = inviteCode?.trim();
  const normalizedInviteLink = inviteLink?.trim();

  if (!normalizedInviteCode) return '';

  return compactLines([
    t('lobby.shareInviteIntro'),
    t('lobby.shareCodeHint'),
    normalizedRoomCode ? `${t('lobby.roomCodeLabel')}: ${formatRoomCode(normalizedRoomCode)}` : null,
    `${t('lobby.inviteCodeLabel')}: ${normalizedInviteCode}`,
    normalizedInviteLink ? t('lobby.shareWebLinkHint') : null,
    normalizedInviteLink ?? null,
  ]);
}
