import { shouldAutoStartWhenRoomIsFull } from '../tableAutoStart';

const human = { isBot: false } as const;
const bot = { isBot: true } as const;

describe('shouldAutoStartWhenRoomIsFull', () => {
  it('waits until a 4-seat table reaches four human players', () => {
    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human],
        maxParticipants: 4,
        state: null,
        configuredDifficulty: 'full',
      }),
    ).toBe(false);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human, human],
        maxParticipants: 4,
        state: null,
        configuredDifficulty: 'full',
      }),
    ).toBe(false);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human, human, human],
        maxParticipants: 4,
        state: null,
        configuredDifficulty: 'full',
      }),
    ).toBe(true);
  });

  it('starts 2-seat and 3-seat tables only when they are full', () => {
    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human],
        maxParticipants: 2,
        state: null,
        configuredDifficulty: 'easy',
      }),
    ).toBe(false);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human],
        maxParticipants: 2,
        state: null,
        configuredDifficulty: 'easy',
      }),
    ).toBe(true);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human],
        maxParticipants: 3,
        state: null,
        configuredDifficulty: 'full',
      }),
    ).toBe(false);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human, human],
        maxParticipants: 3,
        state: null,
        configuredDifficulty: 'full',
      }),
    ).toBe(true);
  });

  it('ignores bots, unconfigured tables, and rooms that already started', () => {
    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human, bot, bot],
        maxParticipants: 4,
        state: null,
        configuredDifficulty: 'full',
      }),
    ).toBe(false);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human, human, human],
        maxParticipants: 4,
        state: null,
        configuredDifficulty: null,
      }),
    ).toBe(false);

    expect(
      shouldAutoStartWhenRoomIsFull({
        players: [human, human, human, human],
        maxParticipants: 4,
        state: { phase: 'building' },
        configuredDifficulty: 'full',
      }),
    ).toBe(false);
  });
});
