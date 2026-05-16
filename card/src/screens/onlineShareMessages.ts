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

export function buildRoomShareMessage({
  t,
  roomCode,
  inviteCode,
}: ShareMessageOptions): string {
  const normalizedRoomCode = roomCode?.trim();
  const normalizedInviteCode = inviteCode?.trim();

  if (!normalizedRoomCode) return '';

  return compactLines([
    t('lobby.shareInviteIntro'),
    t('lobby.shareCodeHint'),
    `${t('lobby.roomCodeLabel')}: ${normalizedRoomCode}`,
    normalizedInviteCode ? `${t('lobby.inviteCodeLabel')}: ${normalizedInviteCode}` : null,
  ]);
}

export function buildPrivateInviteShareMessage({
  t,
  roomCode,
  inviteCode,
}: ShareMessageOptions): string {
  const normalizedRoomCode = roomCode?.trim();
  const normalizedInviteCode = inviteCode?.trim();

  if (!normalizedInviteCode) return '';

  return compactLines([
    t('lobby.shareInviteIntro'),
    t('lobby.shareCodeHint'),
    normalizedRoomCode ? `${t('lobby.roomCodeLabel')}: ${normalizedRoomCode}` : null,
    `${t('lobby.inviteCodeLabel')}: ${normalizedInviteCode}`,
  ]);
}
