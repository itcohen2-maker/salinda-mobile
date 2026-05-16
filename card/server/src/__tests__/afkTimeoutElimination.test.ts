import type { Card, HostGameSettings, Player, ServerGameState } from '../../../shared/types';
import { forceTurnTimeout } from '../gameEngine';

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makePlayer(id: string, hand: Card[], isHost = false): Player {
  return {
    id,
    name: id,
    hand,
    calledLolos: false,
    isConnected: true,
    isHost,
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale: 'he',
  };
}

const hostGameSettings: HostGameSettings = {
  diceMode: '3',
  showFractions: true,
  showPossibleResults: true,
  showSolveExercise: true,
  timerSetting: 'off',
  timerCustomSeconds: 60,
};

function makeState(warnings = 0): ServerGameState {
  const p1 = makePlayer('p1', [makeNumber('a', 1), makeNumber('b', 2)], true);
  const p2 = makePlayer('p2', [makeNumber('c', 3), makeNumber('d', 4)]);
  p1.afkWarnings = warnings;
  return {
    roomCode: 'ROOM',
    phase: 'turn-transition',
    players: [p1, p2],
    currentPlayerIndex: 0,
    drawPile: [makeNumber('deck-1', 5)],
    discardPile: [makeNumber('top', 9)],
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: true,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    courageMeterPercent: 0,
    courageMeterStep: 0,
    courageDiscardSuccessStreak: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    lastCourageRewardReason: null,
    lastCourageCoinsAwarded: false,
    identicalCelebration: null,
    lastMoveMessage: null,
    lastDiscardCount: 0,
    lastEquationDisplay: null,
    difficulty: 'full',
    hostGameSettings,
    winner: null,
    message: '',
    openingDrawId: 'opening',
    turnDeadlineAt: Date.now() + 10_000,
    overflowSwapPending: false,
    overflowSwapDeadlineAt: null,
    overflowSwapCanUseUnderTop: false,
    overflowSwapStage: null,
    overflowSwapSelectedPileChoice: null,
    overflowSwapSelectedHandCardId: null,
    slindaAttemptedThisTurn: false,
    wildAttemptedThisTurn: false,
    roundsPlayed: 0,
    equationCommits: [],
    botPendingStagedIds: null,
    tournamentTable: [
      { playerIndex: 0, playerName: 'p1', wins: 0, losses: 0 },
      { playerIndex: 1, playerName: 'p2', wins: 0, losses: 0 },
    ],
  };
}

function makeThreePlayerState(warnings = 0): ServerGameState {
  const p1 = makePlayer('p1', [makeNumber('a', 1), makeNumber('b', 2)], true);
  const p2 = makePlayer('p2', [makeNumber('c', 3), makeNumber('d', 4)]);
  const p3 = makePlayer('p3', [makeNumber('e', 5), makeNumber('f', 6)]);
  p1.afkWarnings = warnings;
  return {
    ...makeState(warnings),
    players: [p1, p2, p3],
    drawPile: [makeNumber('deck-1', 7)],
    tournamentTable: [
      { playerIndex: 0, playerName: 'p1', wins: 0, losses: 0 },
      { playerIndex: 1, playerName: 'p2', wins: 0, losses: 0 },
      { playerIndex: 2, playerName: 'p3', wins: 0, losses: 0 },
    ],
  };
}

describe('server afk elimination', () => {
  it('ends the game on the third missed turn and points currentPlayerIndex at the winner', () => {
    const result = forceTurnTimeout(makeState(2));

    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.phase).toBe('game-over');
    expect(result.winner?.id).toBe('p2');
    expect(result.currentPlayerIndex).toBe(1);
    expect(result.players[0]?.isEliminated).toBe(true);
    expect(result.players[0]?.isSpectator).toBe(true);
    expect(result.players[0]?.hand).toEqual([]);
    expect(result.drawPile).toHaveLength(3);
    expect(result.lastMoveMessage).toEqual({
      key: 'toast.playerEliminatedAfk',
      params: { name: 'p1' },
    });
  });

  it('clears the eliminated hand and advances to the next active player in 3-player afk elimination', () => {
    const result = forceTurnTimeout(makeThreePlayerState(2));

    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.phase).toBe('turn-transition');
    expect(result.currentPlayerIndex).toBe(1);
    expect(result.players[0]?.isEliminated).toBe(true);
    expect(result.players[0]?.isSpectator).toBe(true);
    expect(result.players[0]?.hand).toEqual([]);
    expect(result.drawPile).toHaveLength(3);
    expect(result.lastMoveMessage).toEqual({
      key: 'toast.eliminatedTurnTo',
      params: { name: 'p1', next: 'p2' },
    });
  });
});
