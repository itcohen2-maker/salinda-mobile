import {
  SALINDA_TUTORIAL_REWARDS,
  SALINDA_GOLD_ROOM_REWARD,
  SALINDA_GAMEPLAY_REWARDS,
  SALINDA_COIN_SOURCES,
  sessionMomentumReward,
  shouldAwardParticipationReward,
} from '../salindaEconomy';

describe('Phase 1 rebalanced economy constants', () => {
  test('onboarding amounts are reduced to a head-start', () => {
    expect(SALINDA_TUTORIAL_REWARDS).toEqual({ basic: 75, advanced: 125 });
    expect(SALINDA_GOLD_ROOM_REWARD).toBe(300);
  });

  test('gameplay rewards are rebalanced and felt', () => {
    expect(SALINDA_GAMEPLAY_REWARDS.excellence_meter_full).toBe(15);
    expect(SALINDA_GAMEPLAY_REWARDS.standard_win).toBe(40);
    expect(SALINDA_GAMEPLAY_REWARDS.first_win_of_day).toBe(100);
    expect(SALINDA_GAMEPLAY_REWARDS.game_participation).toBe(10);
  });

  test('new coin sources exist for the per-game loop', () => {
    expect(SALINDA_COIN_SOURCES.game_participation).toBe('game_participation');
    expect(SALINDA_COIN_SOURCES.session_momentum).toBe('session_momentum');
    expect(SALINDA_COIN_SOURCES.first_win_of_day).toBe('first_win_of_day');
  });
});

describe('sessionMomentumReward', () => {
  test('first game in a session pays no momentum', () => {
    expect(sessionMomentumReward(1)).toBe(0);
  });
  test('grows by 5 per consecutive game', () => {
    expect(sessionMomentumReward(2)).toBe(5);
    expect(sessionMomentumReward(3)).toBe(10);
    expect(sessionMomentumReward(4)).toBe(15);
  });
  test('caps at 30', () => {
    expect(sessionMomentumReward(7)).toBe(30);
    expect(sessionMomentumReward(50)).toBe(30);
  });
  test('guards against bad input', () => {
    expect(sessionMomentumReward(0)).toBe(0);
    expect(sessionMomentumReward(-3)).toBe(0);
  });
});

describe('shouldAwardParticipationReward', () => {
  const base = {
    phase: 'game-over',
    mode: 'vs-bot',
    isTutorial: false,
    rewardSessionKey: 'game-1',
    lastAwardedSessionKey: null as string | null,
  };
  test('awards once per finished local game (win OR loss)', () => {
    expect(shouldAwardParticipationReward(base)).toBe(true);
  });
  test('does not award twice for the same game', () => {
    expect(shouldAwardParticipationReward({ ...base, lastAwardedSessionKey: 'game-1' })).toBe(false);
  });
  test('only solo / vs-bot, never tutorial, only at game-over, needs a key', () => {
    expect(shouldAwardParticipationReward({ ...base, isTutorial: true })).toBe(false);
    expect(shouldAwardParticipationReward({ ...base, phase: 'building' })).toBe(false);
    expect(shouldAwardParticipationReward({ ...base, mode: 'online' })).toBe(false);
    expect(shouldAwardParticipationReward({ ...base, rewardSessionKey: null })).toBe(false);
  });
});
