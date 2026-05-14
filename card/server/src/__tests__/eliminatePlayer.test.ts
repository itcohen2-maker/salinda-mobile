import type { Card, HostGameSettings, Player, ServerGameState } from '../../../shared/types';
import { eliminatePlayer } from '../gameEngine';

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

function makeState3P(): ServerGameState {
  const p1 = makePlayer('p1', [makeNumber('a', 1), makeNumber('b', 2)], true);
  const p2 = makePlayer('p2', [makeNumber('c', 3), makeNumber('d', 4)]);
  const p3 = makePlayer('p3', [makeNumber('e', 5), makeNumber('f', 6)]);
  return {
    roomCode: 'ROOM',
    phase: 'pre-roll',
    players: [p1, p2, p3],
    currentPlayerIndex: 1, // p2's turn
    drawPile: [makeNumber('draw-1', 9)],
    discardPile: [makeNumber('top', 7)],
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: true,
    roundsPlayed: 0,
    hostGameSettings,
    turnDeadlineAt: null,
    lastMoveMessage: null,
    overflowSwapStage: null,
    overflowSwapDeadlineAt: null,
    overflowSwapPending: false,
    overflowSwapCanUseUnderTop: false,
    overflowSwapSelectedPileChoice: null,
    overflowSwapSelectedHandCardId: null,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    courageDiscardSuccessStreak: 0,
    courageMeterStep: 0,
    courageMeterPercent: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    turnCoinsEarned: 0,
    lastCourageCoinsAwarded: false,
    lastCourageRewardReason: null,
    lastDiscardCount: 0,
    lastEquationDisplay: null,
    difficulty: 'full',
    openingDrawId: 'test-opening-draw',
    equationCommits: [],
    tournamentTable: [],
    winner: null,
    message: null,
  };
}

describe('eliminatePlayer', () => {
  it('marks eliminated player as isEliminated and clears hand', () => {
    const st = makeState3P();
    const result = eliminatePlayer(st, 'p3');
    expect(result).not.toBeNull();
    const p3 = result!.players.find(p => p.id === 'p3')!;
    expect(p3.isEliminated).toBe(true);
    expect(p3.hand).toHaveLength(0);
  });

  it('returns eliminated hand cards to draw pile', () => {
    const st = makeState3P();
    const originalDrawCount = st.drawPile.length; // 1
    const p3HandCount = st.players[2].hand.length; // 2
    const result = eliminatePlayer(st, 'p3');
    expect(result!.drawPile.length).toBe(originalDrawCount + p3HandCount);
  });

  it('does not advance turn when eliminated player is not current', () => {
    const st = makeState3P(); // currentPlayerIndex = 1 (p2)
    const result = eliminatePlayer(st, 'p3'); // p3 is index 2
    expect(result!.currentPlayerIndex).toBe(1);
  });

  it('advances turn when eliminated player is current', () => {
    const st = { ...makeState3P(), currentPlayerIndex: 1 }; // p2 is current
    const result = eliminatePlayer(st, 'p2');
    // should advance past p2 to next active
    expect(result!.currentPlayerIndex).not.toBe(1);
    const currentPlayer = result!.players[result!.currentPlayerIndex];
    expect(currentPlayer.isEliminated).toBe(false);
  });

  it('returns game-over when only one active player remains after elimination', () => {
    const st = makeState3P();
    // Eliminate p2 first
    const after1 = eliminatePlayer(st, 'p2')!;
    // Then eliminate p3 — only p1 remains
    const after2 = eliminatePlayer(after1, 'p3');
    expect(after2!.phase).toBe('game-over');
    expect(after2!.winner?.id).toBe('p1');
  });

  it('returns null for unknown playerId', () => {
    const st = makeState3P();
    expect(eliminatePlayer(st, 'nobody')).toBeNull();
  });

  it('returns null if player is already eliminated', () => {
    const st = makeState3P();
    const after = eliminatePlayer(st, 'p3')!;
    expect(eliminatePlayer(after, 'p3')).toBeNull();
  });

  it('clears calledLolos flag on elimination', () => {
    const st = makeState3P();
    st.players[2].calledLolos = true;
    const result = eliminatePlayer(st, 'p3');
    expect(result!.players[2].calledLolos).toBe(false);
  });
});
