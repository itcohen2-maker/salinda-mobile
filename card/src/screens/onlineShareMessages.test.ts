import { buildPrivateInviteShareMessage, buildRoomShareMessage } from './onlineShareMessages';

const labels: Record<string, string> = {
  'lobby.shareInviteIntro': 'You were invited to play Salinda.',
  'lobby.shareCodeHint': 'Share the code so friends can join',
  'lobby.shareInviteCode': 'Share the invite code with invitees',
  'lobby.roomCodeLabel': 'Room code',
  'lobby.inviteCodeLabel': 'Invite code',
};

const t = (key: string): string => labels[key] ?? key;

describe('online share messages', () => {
  it('shares only the room code for a regular room', () => {
    expect(
      buildRoomShareMessage({
        t,
        roomCode: '1234',
        inviteCode: null,
        inviteLink: 'https://salinda.example/?room=1234',
        inviteSuffix: '?room=1234',
      }),
    ).toBe(
      'You were invited to play Salinda.\n' +
        'Share the code so friends can join\n' +
        'Room code: 1234',
    );
  });

  it('adds the invite code to the main share message for a private room', () => {
    expect(
      buildRoomShareMessage({
        t,
        roomCode: '1234',
        inviteCode: '987654',
        inviteLink: 'https://salinda.example/?room=1234&invite=987654',
        inviteSuffix: '?room=1234&invite=987654',
      }),
    ).toBe(
      'You were invited to play Salinda.\n' +
        'Share the code so friends can join\n' +
        'Room code: 1234\n' +
        'Invite code: 987654',
    );
  });

  it('keeps the same short format for the private-share action', () => {
    expect(
      buildPrivateInviteShareMessage({
        t,
        roomCode: '1234',
        inviteCode: '987654',
        inviteLink: '',
        inviteSuffix: '?room=1234&invite=987654',
      }),
    ).toBe(
      'You were invited to play Salinda.\n' +
        'Share the code so friends can join\n' +
        'Room code: 1234\n' +
        'Invite code: 987654',
    );
  });
});
