// ============================================================
// server/src/socketHandlers.ts - Socket.io event handlers
// Connects Room Manager + Game Engine + bot fallback
// ============================================================

import type { Server, Socket } from 'socket.io';
import { randomInt, randomUUID } from 'node:crypto';
import type {
  AppLocale,
  BotDifficulty,
  Card,
  ClassroomSessionReport,
  ClientToServerEvents,
  ContinueVsBotAck,
  HostGameSettings,
  LobbyTableVisibility,
  Operation,
  Player,
  ServerGameState,
  ServerToClientEvents,
  StartBotGameAck,
} from '../../shared/types';
import { pickBotStagedPlan, botStepDelayRange } from '../../shared/botPlan';
import type { LocalizedMessage } from '../../shared/i18n';
import { t, lastMoveSignature, formatLastMove } from '../../shared/i18n';
import {
  sanitizePlayerName,
  validateRoomCode,
  validateCardId,
  validateLocale,
  validateDifficulty,
  validateOperation,
  sanitizeEquationDisplay,
  validatePlayerId,
} from '../../shared/validation';
import { checkRateLimit, cleanupRateLimit } from './rateLimiter';
import {
  createRoom,
  joinRoom,
  joinPrivateRoom,
  leaveRoom,
  destroyRoom,
  reconnectPlayer,
  getRoomBySocket,
  isHost,
  addBotPlayer,
  clearDisconnectGraceTimer,
  hasBot,
  setDisconnectGraceTimer,
  shouldStartDisconnectGrace,
  configureRoomTable,
  markRandomJoiner,
  clearRoomCountdown,
  syncRoomTableStatus,
  getRoomTables,
  getRoomTableSummary,
  promoteConnectedHumanHost,
} from './roomManager';
import {
  closeClassSession,
  createClassSession,
  getClassroomBindingBySocket,
  getClassroomStatesForSession,
  joinClassSession,
  leaveClassSession,
  recordClassroomGroupResult,
  sendClassroomIntervention,
  updateClassroomGroupStatus,
  advanceClassroomRound,
} from './classroomManager';
import {
  startGame,
  beginTurn,
  doRollDice,
  confirmEquation,
  stageCard,
  unstageCard,
  confirmStaged,
  playIdentical,
  playFraction,
  defendFractionSolve,
  defendFractionPenalty,
  playOperation,
  playJoker,
  drawCard,
  doEndTurn,
  getPlayerView,
  forceTurnTimeout,
  resolveOverflowSwap,
  withOnlineTurnDeadline,
  technicalVictory,
  eliminatePlayer,
} from './gameEngine';
import { validateFractionPlay, validateIdenticalPlay, validateStagedCards } from './equations';
import type { Room } from './roomManager';
import { migrateDifficultyStage } from '../../shared/difficultyStages';
import { normalizeOperationToken } from '../../shared/equationOpCycle';
import { pickBotOverflowSwap } from '../../shared/overflowSwap';
import { botNarrationToastText, renderBotNarration, type BotNarrationInput } from '../../shared/botNarration';
import { deductCoinsForPlayer, fetchPlayerActiveTableTheme, recordMatch, RATING_WIN, RATING_LOSS, RATING_ABANDON_PENALTY } from './supabaseAdmin';
import { shouldAutoStartWhenRoomIsFull } from './tableAutoStart';
import { resolveBotConfig, onMatchEnd } from './ddaService';
import { generateDisguisedProfile } from './botDisguise';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const BOT_OFFER_DELAY_MS = 0;
const BOT_DIFF_LEVELS: BotDifficulty[] = ['easy', 'medium', 'hard'];

/** לקוחות ישנים שעדיין שולחים beginner */
function normalizeBotDifficulty(raw: unknown): BotDifficulty {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  if (raw === 'beginner') return 'easy';
  return 'medium';
}

function normalizeGameSettingsPatch(patch?: Partial<HostGameSettings>): Partial<HostGameSettings> | undefined {
  if (!patch) return undefined;
  const out: Partial<HostGameSettings> = { ...patch };
  if ('botDifficulty' in out && out.botDifficulty != null) {
    out.botDifficulty = normalizeBotDifficulty(out.botDifficulty);
  }
  if (out.difficultyStage != null) {
    out.difficultyStage = migrateDifficultyStage(String(out.difficultyStage));
  }
  if (Array.isArray(out.fractionKinds) && out.fractionKinds.length === 0) {
    delete out.fractionKinds;
  }
  if (Array.isArray(out.enabledOperators)) {
    const normalized = out.enabledOperators
      .map((op) => normalizeOperationToken(op))
      .filter((op): op is Operation => op != null);
    out.enabledOperators = normalized.length > 0 ? [...new Set(normalized)] : undefined;
  }
  return out;
}

function normalizeTableVisibility(raw: unknown): LobbyTableVisibility {
  return raw === 'private_locked' ? 'private_locked' : 'public';
}

function playerLocale(room: Room, playerId: string): AppLocale {
  return room.players.find((player) => player.id === playerId)?.locale ?? 'he';
}

function getHumanPlayers(room: Room): Player[] {
  return room.players.filter((player) => !player.isBot);
}

function currentPlayer(room: Room): Player | undefined {
  if (!room.state) return undefined;
  return room.state.players[room.state.currentPlayerIndex];
}

function emitRoomPlayers(io: IOServer, room: Room): void {
  io.to(room.code).emit('player_joined', {
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      isConnected: player.isConnected,
      isBot: player.isBot,
    })),
  });
}

function emitLobbyStatus(io: IOServer, room: Room): void {
  io.to(room.code).emit('lobby_status', {
    status: room.lobbyStatus,
    botOfferAt: room.botOfferAt,
  });
}

function emitTablesUpdated(io: IOServer, socket?: IOSocket): void {
  const payload = { tables: getRoomTables() };
  if (socket) {
    socket.emit('tables_updated', payload);
    return;
  }
  io.emit('tables_updated', payload);
}

function emitRoomCreated(
  socket: IOSocket,
  room: Room,
  playerId: string,
  inviteCode: string | null,
): void {
  socket.emit('room_created', {
    roomCode: room.code,
    playerId,
    inviteCode,
    visibility: room.tableVisibility,
    roomTable: getRoomTableSummary(room),
  });
}

async function hydrateRoomTableTheme(io: IOServer, room: Room, userId?: string): Promise<void> {
  if (!userId) return;
  const theme = await fetchPlayerActiveTableTheme(userId);
  if (room.tableTheme === theme) return;
  room.tableTheme = theme;
  emitTablesUpdated(io);
}

function clearBotOfferTimer(room: Room): void {
  if (room.botOfferTimer) {
    clearTimeout(room.botOfferTimer);
    room.botOfferTimer = undefined;
  }
}

function clearBotActionTimer(room: Room): void {
  if (room.botActionTimer) {
    clearTimeout(room.botActionTimer);
    room.botActionTimer = undefined;
  }
}

function emitRoomToasts(io: IOServer, room: Room): void {
  if (!room.state?.lastMoveMessage) return;
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    const text = formatLastMove(player.locale, room.state.lastMoveMessage);
    if (!text) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(room.code)) continue;
      const info = getRoomBySocket(sock.id);
      if (info && info.playerId === player.id) {
        sock.emit('toast', { message: text });
        break;
      }
    }
  }
}

function cardLabelForLocale(state: ServerGameState, cardId: string, locale: AppLocale): string {
  const card = state.players[state.currentPlayerIndex]?.hand.find((c) => c.id === cardId);
  if (!card) return '—';
  if (card.type === 'number') return String(card.value ?? '?');
  if (card.type === 'fraction') return String(card.fraction ?? '?');
  if (card.type === 'operation') return String(card.operation ?? '?');
  if (card.type === 'wild') return t(locale, 'labels.wild');
  if (card.type === 'joker') return t(locale, 'labels.joker');
  return '—';
}

function cardTypeInCurrentHand(state: ServerGameState, cardId: string): Card['type'] | null {
  return state.players[state.currentPlayerIndex]?.hand.find((c) => c.id === cardId)?.type ?? null;
}

function botNarrationText(locale: AppLocale, input: BotNarrationInput): string {
  const rendered = renderBotNarration((key, params) => t(locale, key, params), input);
  return botNarrationToastText(rendered);
}

function emitBotStepToast(
  _io: IOServer,
  _room: Room,
  _builder: (locale: AppLocale, botName: string) => string,
): void {
  // Bot narration toasts disabled
}

function emitToPlayer(
  io: IOServer,
  room: Room,
  playerId: string,
  emit: (socket: IOSocket) => void,
): boolean {
  for (const [, sock] of io.sockets.sockets) {
    if (!sock.rooms.has(room.code)) continue;
    const info = getRoomBySocket(sock.id);
    if (info && info.playerId === playerId) {
      emit(sock);
      return true;
    }
  }
  return false;
}

function classroomSocketRoom(sessionCode: string): string {
  return `classroom:${sessionCode}`;
}

function emitClassroomState(io: IOServer, sessionCode: string): void {
  const states = getClassroomStatesForSession(sessionCode);
  if (states.length === 0) return;
  const roomName = classroomSocketRoom(sessionCode);
  for (const state of states) {
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(roomName)) continue;
      const binding = getClassroomBindingBySocket(sock.id);
      if (!binding) continue;
      if (binding.sessionCode !== sessionCode || binding.participantId !== state.participantId) continue;
      sock.emit('classroom_state', state);
      break;
    }
  }
}

function emitClassroomClosed(
  io: IOServer,
  sessionCode: string,
  report: ClassroomSessionReport,
): void {
  io.to(classroomSocketRoom(sessionCode)).emit('classroom_closed', { sessionCode, report });
}

function clearRoomTurnTimer(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = undefined;
  }
}

function clearRoomDisconnectGrace(room: Room): void {
  clearDisconnectGraceTimer(room);
}

async function handleActiveGameExit(
  io: IOServer,
  room: Room,
  leavingPlayerId: string,
): Promise<void> {
  if (!room.state || room.state.phase === 'game-over') return;

  const leavingPlayer = room.players.find((p) => p.id === leavingPlayerId);
  const leavingName = leavingPlayer?.name ?? 'Player';

  clearRoomTurnTimer(room);
  clearBotActionTimer(room);

  const remainingHumans = room.players.filter(
    (p) => !p.isBot && p.isConnected && p.id !== leavingPlayerId,
  );
  if (remainingHumans.length > 0) {
    promoteConnectedHumanHost(room, remainingHumans[0]?.id ?? null);
  }

  if (remainingHumans.length >= 2) {
    // 3-player+ game: eliminate the exiting player and continue
    const newState = eliminatePlayer(room.state, leavingPlayerId);
    if (!newState) return;
    room.state = newState;
    room.lastActivity = Date.now();

    for (const p of room.players) {
      if (p.id === leavingPlayerId || p.isBot || !p.isConnected) continue;
      emitToPlayer(io, room, p.id, (s) => {
        s.emit('player_eliminated', { playerId: leavingPlayerId, playerName: leavingName });
      });
    }

    broadcastState(io, room);

    if (newState.phase === 'game-over') {
      emitRoomToasts(io, room);
      maybeRecordMatch(room);
    } else {
      scheduleRoomTurnTimer(io, room);
      scheduleBotAction(io, room);
    }
  } else if (remainingHumans.length === 1) {
    // 2-player game: automatic technical victory for the survivor
    clearRoomTurnTimer(room);
    clearBotActionTimer(room);
    clearRoomDisconnectGrace(room);
    room.lastActivity = Date.now();
    const tvResult = technicalVictory(room.state, leavingPlayerId);
    if (!tvResult) return;
    room.state = tvResult;
    broadcastState(io, room);
    emitRoomToasts(io, room);
    maybeRecordMatch(room);
  } else {
    // Nobody left: tear down the room
    destroyRoom(room.code);
    emitTablesUpdated(io);
  }
}

function sendGameStarted(io: IOServer, room: Room): void {
  if (!room.state) return;
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(room.code)) continue;
      const info = getRoomBySocket(sock.id);
      if (info && info.playerId === player.id) {
        sock.emit('game_started', getPlayerView(room.state, player.id, player.locale));
        break;
      }
    }
  }
}

function broadcastState(io: IOServer, room: Room): void {
  if (!room.state) return;
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(room.code)) continue;
      const info = getRoomBySocket(sock.id);
      if (info && info.playerId === player.id) {
        sock.emit('state_update', getPlayerView(room.state, player.id, player.locale));
        break;
      }
    }
  }
}

function scheduleRoomTurnTimer(io: IOServer, room: Room): void {
  clearRoomTurnTimer(room);
  // Don't fire turn timers while waiting for the survivor to make a disconnect choice —
  // otherwise a race-condition draw_card can trigger an AFK cycle on the absent player.
  if (room.disconnectedPlayerId) {
    const connectedHumans = room.players.filter((p) => !p.isBot && p.isConnected);
    if (connectedHumans.length === 1) return;
  }
  const deadlineAt = room.state?.overflowSwapDeadlineAt ?? room.state?.turnDeadlineAt ?? null;
  if (!deadlineAt) return;
  const ms = Math.max(0, deadlineAt - Date.now());
  room.turnTimer = setTimeout(() => {
    room.turnTimer = undefined;
    const liveDeadlineAt = room.state?.overflowSwapDeadlineAt ?? room.state?.turnDeadlineAt ?? null;
    if (!liveDeadlineAt) return;
    if (Date.now() < liveDeadlineAt - 150) {
      scheduleRoomTurnTimer(io, room);
      return;
    }
    const liveState = room.state;
    if (!liveState) return;
    const result = forceTurnTimeout(liveState);
    if ('error' in result) return;
    const prevSig = lastMoveSignature(liveState.lastMoveMessage);
    room.state = withOnlineTurnDeadline(result);
    room.lastActivity = Date.now();
    if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
      emitRoomToasts(io, room);
    }
    broadcastState(io, room);
    scheduleRoomTurnTimer(io, room);
    scheduleBotAction(io, room);
  }, ms);
}

function scheduleBotOffer(io: IOServer, room: Room): void {
  clearBotOfferTimer(room);
  if (room.state || hasBot(room) || getHumanPlayers(room).length !== 1) return;
  // No delay — the bot-offer is available the moment the host is alone.
  // Previously this was a 15s wait (later 3s) to give a chance for a friend
  // to join before suggesting a bot; users found it annoying, so it was
  // removed entirely. If a countdown is ever wanted, re-introduce via a
  // positive BOT_OFFER_DELAY_MS + setTimeout.
  if (BOT_OFFER_DELAY_MS <= 0) {
    room.lobbyStatus = 'bot_offer';
    room.botOfferAt = null;
    emitLobbyStatus(io, room);
    return;
  }
  room.lobbyStatus = 'waiting_for_player';
  room.botOfferAt = Date.now() + BOT_OFFER_DELAY_MS;
  emitLobbyStatus(io, room);
  room.botOfferTimer = setTimeout(() => {
    room.botOfferTimer = undefined;
    if (room.state || hasBot(room) || getHumanPlayers(room).length !== 1) return;
    room.lobbyStatus = 'bot_offer';
    room.botOfferAt = null;
    emitLobbyStatus(io, room);
  }, BOT_OFFER_DELAY_MS);
}

function refreshLobbyStatus(io: IOServer, room: Room): void {
  syncRoomTableStatus(room);
  if (room.state) {
    room.lobbyStatus = hasBot(room) ? 'bot_game_started' : 'waiting_for_player';
    room.botOfferAt = null;
    clearBotOfferTimer(room);
    emitLobbyStatus(io, room);
    return;
  }

  const humanCount = getHumanPlayers(room).length;
  if (hasBot(room)) {
    room.lobbyStatus = 'bot_game_started';
    room.botOfferAt = null;
    clearBotOfferTimer(room);
    emitLobbyStatus(io, room);
    return;
  }

  if (humanCount === 1) {
    scheduleBotOffer(io, room);
    return;
  }

  room.lobbyStatus = 'waiting_for_player';
  room.botOfferAt = null;
  clearBotOfferTimer(room);
  emitLobbyStatus(io, room);
}

function applyAction(
  io: IOServer,
  socket: IOSocket,
  room: Room,
  actorPlayerId: string,
  actionFn: (state: ServerGameState) => ServerGameState | { error: LocalizedMessage },
): void {
  if (!room.state) {
    socket.emit('error', { message: t(playerLocale(room, actorPlayerId), 'game.notStarted') });
    return;
  }

  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
  }

  const result = actionFn(room.state);
  if ('error' in result) {
    socket.emit('error', {
      message: t(playerLocale(room, actorPlayerId), result.error.key, result.error.params),
    });
    return;
  }

  const prevSig = lastMoveSignature(room.state.lastMoveMessage);
  room.state = withOnlineTurnDeadline(result);
  room.lastActivity = Date.now();
  if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
    emitRoomToasts(io, room);
  }

  broadcastState(io, room);
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
    broadcastState(io, room);
  }
  maybeRecordMatch(room);
  scheduleRoomTurnTimer(io, room);
  scheduleBotAction(io, room);
}

function applyBotState(
  io: IOServer,
  room: Room,
  actionFn: (state: ServerGameState) => ServerGameState | { error: LocalizedMessage },
): boolean {
  if (!room.state) return false;
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
  }

  const result = actionFn(room.state);
  if ('error' in result) return false;

  const prevSig = lastMoveSignature(room.state.lastMoveMessage);
  room.state = withOnlineTurnDeadline(result);
  room.lastActivity = Date.now();
  if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
    emitRoomToasts(io, room);
  }
  broadcastState(io, room);
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
    broadcastState(io, room);
  }
  maybeRecordMatch(room);
  scheduleRoomTurnTimer(io, room);
  return true;
}

function isMyTurn(room: Room, playerId: string): boolean {
  if (!room.state) return false;
  const player = currentPlayer(room);
  if (!player || player.isEliminated || player.isSpectator) return false;
  return player.id === playerId;
}

function canPlayerAct(
  room: Room,
  playerId: string,
  options?: { allowOverflowPending?: boolean },
): { ok: true } | { ok: false; reason: LocalizedMessage } {
  if (!room.state) return { ok: false, reason: { key: 'game.notStarted' } };
  const player = room.state.players.find((candidate) => candidate.id === playerId);
  if (!player) return { ok: false, reason: { key: 'game.playerNotFound' } };
  if (player.isEliminated || player.isSpectator) {
    return { ok: false, reason: { key: 'game.eliminatedSpectator' } };
  }
  if (!isMyTurn(room, playerId)) return { ok: false, reason: { key: 'game.notYourTurn' } };
  if (room.state.overflowSwapPending && !options?.allowOverflowPending) {
    return { ok: false, reason: { key: 'overflowSwap.required' } };
  }
  return { ok: true };
}

/** בוט משתמש לכל היותר בקלף פעולה/סלינדה אחד במשבצת 0 */
function handleBotDefense(io: IOServer, room: Room, state: ServerGameState): void {
  const diff: BotDifficulty = state.hostGameSettings.botDifficulty ?? 'medium';

  // Pity bot: always ignore defense — take the penalty.
  if (diff === 'pity') {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'defendFractionPenalty', name, penalty: String(state.fractionPenalty) }),
    );
    applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
    return;
  }

  // Easy bot: 50% chance to ignore defense entirely.
  if (diff === 'easy' && Math.random() < 0.5) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'defendFractionPenalty', name, penalty: String(state.fractionPenalty) }),
    );
    applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
    return;
  }

  // Existing optimal logic follows unchanged...
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const divisibleCard = hand.find((card) => card.type === 'number' && (card.value ?? 0) > 0 && (card.value ?? 0) % state.fractionPenalty === 0);
  if (divisibleCard) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'defendFractionSolveNumber',
        name,
        card: cardLabelForLocale(state, divisibleCard.id, locale),
        penalty: String(state.fractionPenalty),
      }),
    );
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, divisibleCard.id));
    return;
  }

  const wildCard = hand.find((card) => card.type === 'wild');
  if (wildCard) {
    const wildResolve = Math.max(state.fractionPenalty, 1);
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'defendFractionSolveWild',
        name,
        card: cardLabelForLocale(state, wildCard.id, locale),
        value: String(wildResolve),
        penalty: String(state.fractionPenalty),
      }),
    );
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, wildCard.id, wildResolve));
    return;
  }

  const counterFraction = hand.find((card) => card.type === 'fraction');
  if (counterFraction) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'playFractionBlock',
        name,
        card: cardLabelForLocale(state, counterFraction.id, locale),
      }),
    );
    applyBotState(io, room, (currentState) => playFraction(currentState, counterFraction.id));
    return;
  }

  emitBotStepToast(io, room, (locale, name) =>
    botNarrationText(locale, { kind: 'defendFractionPenalty', name, penalty: String(state.fractionPenalty) }),
  );
  applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
}

function handleBotPreRoll(io: IOServer, room: Room, state: ServerGameState): void {
  const diff: BotDifficulty = state.hostGameSettings.botDifficulty ?? 'medium';
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const allIdenticalCandidates = hand.filter((card) => validateIdenticalPlay(card, topDiscard));
  let identicalCard: typeof hand[number] | undefined = allIdenticalCandidates[0];

  // Medium/Hard (not easy, not pity): prefer non-wild; defer wild if it can be used in equation.
  if (diff !== 'easy' && diff !== 'pity' && identicalCard && identicalCard.type === 'wild') {
    const nonWildIdentical = allIdenticalCandidates.find((c) => c.type !== 'wild');
    if (nonWildIdentical) {
      identicalCard = nonWildIdentical;
    } else {
      const hasWild = hand.some((c) => c.type === 'wild');
      const numberCount = hand.filter((c) => c.type === 'number' && typeof c.value === 'number').length;
      if (hasWild && numberCount >= 1) identicalCard = undefined;
    }
  }

  // Medium: probabilistic 50% wild conservation gate.
  if (diff === 'medium' && identicalCard?.type === 'wild' && Math.random() < 0.5) {
    identicalCard = undefined;
  }

  if (identicalCard) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'playIdentical',
        name,
        card: cardLabelForLocale(state, identicalCard!.id, locale),
      }),
    );
    applyBotState(io, room, (currentState) => playIdentical(currentState, identicalCard!.id));
    return;
  }

  const attackFraction = hand.find((card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard));
  if (attackFraction) {
    emitBotStepToast(io, room, (locale) => {
      const denom = Number(String(attackFraction.fraction ?? '').split('/')[1] ?? 0) || 1;
      const topVisibleValue =
        topDiscard?.resolvedValue ?? (topDiscard?.type === 'number' ? (topDiscard.value ?? null) : null);
      const divideX = topVisibleValue ?? state.pendingFractionTarget ?? denom;
      return botNarrationText(locale, { kind: 'playFractionAttack', x: String(divideX), y: String(Math.max(1, denom)) });
    });
    applyBotState(io, room, (currentState) => playFraction(currentState, attackFraction.id));
    return;
  }

  emitBotStepToast(io, room, (locale, name) => botNarrationText(locale, { kind: 'rollDice', name }));
  applyBotState(io, room, (currentState) => doRollDice(currentState));
}

function handleBotBuilding(io: IOServer, room: Room, state: ServerGameState): void {
  const pending = state.botPendingStagedIds;
  if (pending != null && state.phase === 'solved' && !state.hasPlayedCards) {
    if (pending.length > 0) {
      const cardId = pending[0]!;
      emitBotStepToast(io, room, (locale, name) => {
        const type = cardTypeInCurrentHand(state, cardId);
        const card = cardLabelForLocale(state, cardId, locale);
        if (type === 'number') return botNarrationText(locale, { kind: 'stageNumber', name, card });
        if (type === 'wild') return botNarrationText(locale, { kind: 'stageWild', name, card });
        if (type === 'operation') return botNarrationText(locale, { kind: 'stageOperation', name, card });
        return botNarrationText(locale, { kind: 'stageCard', name, card });
      });
      applyBotState(io, room, (s) => {
        const r = stageCard(s, cardId);
        if ('error' in r) return r;
        return { ...r, botPendingStagedIds: pending.slice(1) };
      });
      return;
    }
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'confirmStaged', name }),
    );
    applyBotState(io, room, (s) => {
      const r = confirmStaged(s);
      if ('error' in r) return r;
      return { ...r, botPendingStagedIds: null };
    });
    return;
  }

  const diff: BotDifficulty = state.hostGameSettings.botDifficulty ?? 'medium';
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const picked = pickBotStagedPlan(
    state.validTargets,
    hand,
    state.hostGameSettings.mathRangeMax ?? 25,
    validateStagedCards,
    diff,
  );
  if (!picked) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'drawCard', name }),
    );
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  emitBotStepToast(io, room, (locale, name) => {
    const jokerCommit = picked.equationCommits.find((c) => c.jokerAs != null);
    const operationCommit = picked.equationCommits.find((c) => {
      const card = state.players[state.currentPlayerIndex]?.hand.find((h) => h.id === c.cardId);
      return card?.type === 'operation';
    });
    return botNarrationText(locale, {
      kind: 'confirmEquation',
      name,
      equation: picked.equationDisplay,
      target: String(picked.target),
      jokerOp: jokerCommit ? String(jokerCommit.jokerAs ?? '+') : undefined,
      operationLabel: operationCommit ? cardLabelForLocale(state, operationCommit.cardId, locale) : undefined,
    });
  });
  const equationOk = applyBotState(io, room, (currentState) =>
    confirmEquation(currentState, picked.target, picked.equationDisplay, picked.equationCommits),
  );
  if (!equationOk || !room.state) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'drawCard', name }),
    );
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  if (picked.stagedCardIds.length === 0) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'confirmStaged', name }),
    );
    applyBotState(io, room, (currentState) => confirmStaged(currentState));
    return;
  }

  applyBotState(io, room, (s) => ({ ...s, botPendingStagedIds: [...picked.stagedCardIds] }));
}

function runBotStep(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  // Pity bot surrender: after turn 4, if the bot is losing by >30%, quit with 30% chance.
  // This simulates a frustrated human player disconnecting.
  // Surrender only applies in 1v1 bot games. roundsPlayed increments once per full
  // round (both players take a turn), so >= 4 means the bot has had 4 complete turns.
  const pityDiff: BotDifficulty = room.state.hostGameSettings.botDifficulty ?? 'medium';
  if (pityDiff === 'pity') {
    const botPlayer = room.state.players.find((p) => p.isBot);
    const humanPlayer = room.state.players.find((p) => !p.isBot && !p.isEliminated && !p.isSpectator);
    const turnNum = room.state.roundsPlayed ?? 0;
    if (botPlayer && humanPlayer && turnNum >= 4) {
      const humanCoins = Number(humanPlayer.courageCoins ?? 0);
      const botCoins = Number(botPlayer.courageCoins ?? 0);
      if (humanCoins > 0 && botCoins <= humanCoins * 0.7 && Math.random() < 0.3) {
        // Bot surrenders — apply technical victory for the human, same as a grace-timer expiry.
        const tvResult = technicalVictory(room.state, botPlayer.id);
        if (tvResult) {
          room.state = tvResult;
          clearBotActionTimer(room);
          broadcastState(io, room);
          emitRoomToasts(io, room);
          maybeRecordMatch(room);
        }
        return;
      }
    }
  }

  switch (room.state.phase) {
    case 'turn-transition':
      if (room.state.overflowSwapPending) {
        const hand = room.state.players[room.state.currentPlayerIndex]?.hand ?? [];
        const discardPile = room.state.discardPile ?? [];
        const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
        const underTopCard = discardPile.length > 1 ? discardPile[discardPile.length - 2] : null;
        const choice = pickBotOverflowSwap(hand, topCard, underTopCard);
        applyBotState(io, room, (state) =>
          resolveOverflowSwap(
            state,
            choice?.handCardId ?? null,
            choice?.pileChoice ?? 'random',
            true,
          ),
        );
        break;
      }
      emitBotStepToast(io, room, (locale, name) =>
        botNarrationText(locale, { kind: 'beginTurn', name }),
      );
      applyBotState(io, room, (state) => beginTurn(state));
      break;
    case 'pre-roll':
      if (room.state.pendingFractionTarget !== null) handleBotDefense(io, room, room.state);
      else handleBotPreRoll(io, room, room.state);
      break;
    case 'building':
      handleBotBuilding(io, room, room.state);
      break;
    case 'solved':
      if (room.state.botPendingStagedIds != null) {
        handleBotBuilding(io, room, room.state);
      } else {
        emitBotStepToast(io, room, (locale, name) =>
          botNarrationText(locale, { kind: 'endTurn', name }),
        );
        applyBotState(io, room, (state) => doEndTurn(state));
      }
      break;
    default:
      break;
  }

  scheduleBotAction(io, room);
}

function scheduleBotAction(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  const diff: BotDifficulty = room.state.hostGameSettings.botDifficulty ?? 'medium';
  const { min, max } = botStepDelayRange(diff);
  const delay = min + randomInt(0, Math.max(1, max - min + 1));
  room.botActionTimer = setTimeout(() => runBotStep(io, room), delay);
}

/**
 * Fire-and-forget: persist match result to Supabase when the game reaches
 * 'game-over'. Idempotent via `room.matchRecorded` guard.
 */
function maybeRecordMatch(room: Room): void {
  if (!room.state || room.state.phase !== 'game-over') return;
  if (room.matchRecorded) return;
  room.matchRecorded = true;

  const state = room.state;
  const humanPlayers = state.players.filter((p) => !p.isBot);
  if (humanPlayers.length === 0) return; // solo-bot practice — nothing to record

  const gameWinnerId = state.winner?.id ?? null;
  // Only record authenticated players; skip guests (supabaseUserId is undefined)
  const authenticatedPlayers = humanPlayers.filter((p) => !!p.supabaseUserId);
  if (authenticatedPlayers.length === 0) return; // all guests — nothing to record

  const participants = authenticatedPlayers.map((p) => {
    const isWinner = p.id === gameWinnerId;
    const abandoned = !p.isConnected && !isWinner;
    const delta = abandoned
      ? -RATING_ABANDON_PENALTY
      : isWinner
        ? RATING_WIN
        : -RATING_LOSS;
    return {
      playerId: p.supabaseUserId!,
      delta,
      abandoned,
      coinsEarned: abandoned ? 0 : Math.max(0, Math.floor(Number(p.courageCoins ?? 0) || 0)),
    };
  });

  // Resolve winnerId to supabase UID for the match record
  const winnerPlayer = gameWinnerId ? authenticatedPlayers.find((p) => p.id === gameWinnerId) : null;
  const winnerId = winnerPlayer?.supabaseUserId ?? null;

  recordMatch({
    roomCode: room.code,
    difficulty: state.difficulty ?? null,
    playerCount: humanPlayers.length,
    startedAt: new Date(room.gameStartedAt ?? room.createdAt),
    winnerId,
    participants,
  }).catch((err) => console.error('[socketHandlers] maybeRecordMatch failed:', err));

  // Update DDA fields only for bot games — PvP losses don't affect bot difficulty.
  const isBotGame = state.players.some((p) => p.isBot);
  if (isBotGame) {
    for (const p of authenticatedPlayers) {
      const isWinner = p.id === gameWinnerId;
      const abandoned = !p.isConnected && !isWinner;
      const didWin = isWinner && !abandoned;
      onMatchEnd(p.supabaseUserId!, didWin).catch((err) =>
        console.error('[socketHandlers] onMatchEnd failed:', err),
      );
    }
  }
}

function startRoomGame(
  io: IOServer,
  room: Room,
  difficulty: 'easy' | 'full',
  gameSettings?: Partial<HostGameSettings>,
): void {
  clearRoomCountdown(room);
  room.state = startGame(room, difficulty, gameSettings);
  room.gameStartedAt = Date.now();
  room.matchRecorded = false;
  room.lastActivity = Date.now();
  clearRoomDisconnectGrace(room);
  syncRoomTableStatus(room);
  room.lobbyStatus = hasBot(room) ? 'bot_game_started' : 'waiting_for_player';
  room.botOfferAt = null;
  emitLobbyStatus(io, room);
  io.to(room.code).emit('table_status_changed', {
    roomCode: room.code,
    status: room.tableStatus,
    countdownEndsAt: room.countdownEndsAt,
  });
  emitTablesUpdated(io);
  sendGameStarted(io, room);
  scheduleRoomTurnTimer(io, room);
  scheduleBotAction(io, room);
}

function handleWaitingRoomRosterChange(io: IOServer, room: Room): void {
  const humanCount = room.players.filter((player) => !player.isBot).length;
  if (room.countdownEndsAt != null && humanCount < 2) {
    clearRoomCountdown(room);
    io.to(room.code).emit('table_status_changed', {
      roomCode: room.code,
      status: room.tableStatus,
      countdownEndsAt: null,
    });
  }
  syncRoomTableStatus(room);
  emitTablesUpdated(io);
}

function maybeAutoStartFullTable(io: IOServer, room: Room): boolean {
  if (!shouldAutoStartWhenRoomIsFull(room)) return false;
  startTableCountdown(io, room);
  return true;
}

function startTableCountdown(io: IOServer, room: Room): void {
  const difficulty = room.configuredDifficulty;
  if (!difficulty) return;
  startRoomGame(io, room, difficulty, room.configuredGameSettings ?? undefined);
}

export function registerSocketHandlers(io: IOServer, socket: IOSocket): void {
  /** Rate-limit guard — returns true if the request should be blocked */
  function rateLimited(): boolean {
    if (!checkRateLimit(socket.id)) {
      console.warn(`[SECURITY] Rate limit exceeded: ${socket.id}`);
      socket.emit('error', { message: 'Too many requests' });
      return true;
    }
    return false;
  }

  socket.on('list_tables', () => {
    emitTablesUpdated(io, socket);
  });

  socket.on('create_table', ({ playerName, locale }) => {
    if (rateLimited()) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const loc = validateLocale(locale);
    const { room, playerId } = createRoom(name, socket.id, loc);
    const creatingPlayer = room.players.find((p) => p.id === playerId);
    if (creatingPlayer) creatingPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    emitRoomCreated(socket, room, playerId, room.inviteCode);
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    emitTablesUpdated(io);
    void hydrateRoomTableTheme(io, room, socket.data.userId);
  });

  socket.on('configure_table', ({ visibility, maxParticipants, difficulty, gameSettings }) => {
    if (rateLimited()) return;
    const diff = validateDifficulty(difficulty);
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!diff) {
      socket.emit('error', { message: 'Invalid difficulty' });
      return;
    }
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyStart') });
      return;
    }
    configureRoomTable(room, {
      visibility: normalizeTableVisibility(visibility),
      maxParticipants,
      difficulty: diff,
      gameSettings: normalizeGameSettingsPatch(gameSettings),
    });
    emitRoomCreated(socket, room, playerId, room.inviteCode);
    refreshLobbyStatus(io, room);
    if (maybeAutoStartFullTable(io, room)) return;
    emitTablesUpdated(io);
  });

  socket.on('join_table', ({ roomCode, playerName, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const name = sanitizePlayerName(playerName);
    const loc = validateLocale(locale);
    if (!code) {
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const result = joinRoom(code, name, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    markRandomJoiner(room);
    const joiningPlayer = room.players.find((p) => p.id === playerId);
    if (joiningPlayer) joiningPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    emitRoomCreated(socket, room, playerId, null);
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    if (maybeAutoStartFullTable(io, room)) return;
    handleWaitingRoomRosterChange(io, room);
  });

  socket.on('join_private_table_with_code', ({ roomCode, inviteCode, playerName, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const safeInvite = String(inviteCode ?? '').trim();
    const name = sanitizePlayerName(playerName);
    const loc = validateLocale(locale);
    if (!code) {
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const result = joinPrivateRoom(code, safeInvite, name, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    const joiningPlayer = room.players.find((p) => p.id === playerId);
    if (joiningPlayer) joiningPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    emitRoomCreated(socket, room, playerId, null);
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    if (maybeAutoStartFullTable(io, room)) return;
    handleWaitingRoomRosterChange(io, room);
  });

  socket.on('start_table_countdown', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyCountdown') });
      return;
    }
    if (room.state) {
      socket.emit('error', { message: t(loc, 'room.gameAlreadyStarted') });
      return;
    }
    if (room.players.filter((player) => !player.isBot).length < 2) {
      socket.emit('error', { message: t(loc, 'game.minTwoPlayers') });
      return;
    }
    if (!room.configuredDifficulty) {
      socket.emit('error', { message: t(loc, 'game.tableNotConfigured') });
      return;
    }
    if (room.countdownEndsAt != null) {
      socket.emit('error', { message: t(loc, 'game.countdownAlreadyRunning') });
      return;
    }
    startTableCountdown(io, room);
  });

  socket.on('create_room', ({ playerName, locale }) => {
    if (rateLimited()) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const loc = validateLocale(locale);
    const { room, playerId } = createRoom(name, socket.id, loc);
    const creatingPlayer = room.players.find((p) => p.id === playerId);
    if (creatingPlayer) creatingPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    emitRoomCreated(socket, room, playerId, room.inviteCode);
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    emitTablesUpdated(io);
  });

  socket.on('join_room', ({ roomCode, playerName, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const name = sanitizePlayerName(playerName);
    const loc = validateLocale(locale);
    if (!code) {
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const result = joinRoom(code, name, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    const joiningPlayer = room.players.find((p) => p.id === playerId);
    if (joiningPlayer) joiningPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    emitRoomCreated(socket, room, playerId, null);
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    if (maybeAutoStartFullTable(io, room)) return;
    handleWaitingRoomRosterChange(io, room);
  });

  socket.on('leave_room', async () => {
    if (rateLimited()) return;
    const activeInfo = getRoomBySocket(socket.id);
    if (activeInfo?.room.state && activeInfo.room.state.phase !== 'game-over') {
      // Notify leaving player immediately before removing their socket
      socket.emit('room_closed', { roomCode: activeInfo.room.code });
      socket.leave(activeInfo.room.code);
      leaveRoom(socket.id);
      await handleActiveGameExit(io, activeInfo.room, activeInfo.playerId);
      return;
    }
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    socket.leave(room.code);
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.players.length > 0) {
      clearRoomDisconnectGrace(room);
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
      handleWaitingRoomRosterChange(io, room);
    } else {
      emitTablesUpdated(io);
    }
  });

  socket.on('reconnect', ({ roomCode, playerId, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const pid = validatePlayerId(playerId);
    const loc = validateLocale(locale);
    if (!code || !pid) {
      console.warn(`[SECURITY] Invalid reconnect attempt: room=${roomCode} player=${playerId} socket=${socket.id}`);
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    const result = reconnectPlayer(code, pid, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, player } = result;
    if (socket.data.userId) player.supabaseUserId = socket.data.userId;
    socket.join(room.code);
    // Player was eliminated mid-game — send them home
    if (player.isEliminated) {
      socket.emit('room_closed', { roomCode: room.code, reason: 'eliminated' });
      socket.leave(room.code);
      return;
    }
    if (room.disconnectedPlayerId === player.id) {
      clearRoomDisconnectGrace(room);
      room.lastActivity = Date.now();
      for (const other of room.players) {
        if (other.id === player.id || other.isBot || !other.isConnected) continue;
        emitToPlayer(io, room, other.id, (peerSocket) => {
          peerSocket.emit('opponent_reconnected', { playerId: player.id, playerName: player.name });
        });
      }
    }
    if (room.state && room.state.phase !== 'game-over') {
      room.state = withOnlineTurnDeadline(room.state);
      socket.emit('state_update', getPlayerView(room.state, playerId, player.locale));
      scheduleRoomTurnTimer(io, room);
    }
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    if (maybeAutoStartFullTable(io, room)) return;
    handleWaitingRoomRosterChange(io, room);
    scheduleBotAction(io, room);
  });

  socket.on('start_game', ({ difficulty, gameSettings }) => {
    if (rateLimited()) return;
    const diff = validateDifficulty(difficulty);
    if (!diff) {
      socket.emit('error', { message: 'Invalid difficulty' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyStart') });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: t(loc, 'game.minTwoPlayers') });
      return;
    }
    if (room.state) {
      socket.emit('error', { message: t(loc, 'room.gameAlreadyStarted') });
      return;
    }

    startRoomGame(io, room, diff, normalizeGameSettingsPatch(gameSettings));
  });

  socket.on('start_bot_game', async ({ difficulty, gameSettings }, ack) => {
    if (rateLimited()) return;
    const diff = validateDifficulty(difficulty);
    const reply = (result: StartBotGameAck) => {
      if (typeof ack === 'function') ack(result);
    };
    if (!diff) {
      socket.emit('error', { message: 'Invalid difficulty' });
      reply({ ok: false, message: 'Invalid difficulty' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      const message = t(loc, 'game.noRoom');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      const message = t(loc, 'game.hostOnlyStart');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    if (room.state) {
      const message = t(loc, 'room.gameAlreadyStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    if (getHumanPlayers(room).length > 1) {
      const message = t(loc, 'game.botAlreadyHasOpponent');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    const normalizedSettings = normalizeGameSettingsPatch(gameSettings);
    const requestedBotDiff: BotDifficulty = normalizedSettings?.botDifficulty ?? 'medium';
    const userId = socket.data.userId ?? null;
    const { difficulty: resolvedBotDiff, isPity } = await resolveBotConfig(userId, requestedBotDiff);

    // Re-validate after the Supabase await — another event could have mutated the room.
    if (room.state || getHumanPlayers(room).length > 1) {
      const message = t(loc, 'room.gameAlreadyStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    const disguise = isPity ? generateDisguisedProfile() : null;
    const botDisplayName = disguise?.displayName ?? normalizedSettings?.botDisplayName;
    addBotPlayer(room, loc, botDisplayName);
    emitRoomPlayers(io, room);

    const finalSettings = { ...normalizedSettings, botDifficulty: resolvedBotDiff };
    startRoomGame(io, room, diff, finalSettings);
    if (!room.state) {
      const message = t(loc, 'game.notStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    const playerView = getPlayerView(room.state, playerId, playerLocale(room, playerId));
    reply({ ok: true, playerView });
  });

  socket.on('continue_vs_bot', async (payloadOrAck, maybeAck) => {
    if (rateLimited()) return;
    const payload =
      typeof payloadOrAck === 'function' || payloadOrAck == null
        ? undefined
        : payloadOrAck;
    const ack =
      typeof payloadOrAck === 'function'
        ? payloadOrAck
        : maybeAck;
    const reply = (result: ContinueVsBotAck) => {
      if (typeof ack === 'function') ack(result);
    };
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      const message = t(loc, 'game.noRoom');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    const { room, playerId } = info;
    if (!room.state) {
      const message = t(loc, 'game.notStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    if (!room.disconnectedPlayerId || room.disconnectedPlayerId === playerId) {
      const message = loc === 'he' ? 'אין שחקן מנותק להחלפה בבוט.' : 'No disconnected opponent to replace with a bot.';
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    const target = room.players.find((player) => player.id === room.disconnectedPlayerId && !player.isBot);
    if (!target || target.isConnected) {
      const message = loc === 'he' ? 'השחקן כבר חזר או לא זמין להחלפה.' : 'Player already reconnected or unavailable for bot replacement.';
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    // If a previous DDA pass set botDifficulty to 'pity', normalise back to 'medium'
    // so it passes the BOT_DIFF_LEVELS guard; resolveBotConfig will re-apply pity if needed.
    const rawFallback = room.state.hostGameSettings.botDifficulty;
    const safeFallback: BotDifficulty = rawFallback === 'pity' ? 'medium' : (rawFallback ?? 'medium');
    const requestedDifficulty = payload?.difficulty != null
      ? normalizeBotDifficulty(payload.difficulty)
      : safeFallback;
    if (!BOT_DIFF_LEVELS.includes(requestedDifficulty)) {
      const message = t(loc, 'game.invalidBotDifficulty');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    const userId = socket.data.userId ?? null;
    const { difficulty: resolvedBotDiff, isPity } = await resolveBotConfig(userId, requestedDifficulty as BotDifficulty);

    // Re-validate after await — the disconnected player may have reconnected.
    const refreshedTarget = room.players.find((p) => p.id === room.disconnectedPlayerId && !p.isBot);
    if (!refreshedTarget || refreshedTarget.isConnected) {
      const message = loc === 'he' ? 'השחקן כבר חזר.' : 'Player already reconnected.';
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    const disguise = isPity ? generateDisguisedProfile() : null;
    target.isBot = true;
    target.isConnected = true;
    target.isHost = false;
    target.name = disguise?.displayName ?? (target.locale === 'he' ? 'בוט' : 'Bot');

    // Sync room.state.players — it's a separate array created by spread in startGame,
    // so mutating room.players alone leaves isBot=false in the game engine.
    const stateTarget = room.state.players.find((p) => p.id === target.id);
    if (stateTarget) {
      stateTarget.isBot = true;
      stateTarget.isConnected = true;
      stateTarget.isHost = false;
      stateTarget.name = target.name;
    }

    // Sync bot difficulty override into live game state.
    if (room.state) {
      room.state = {
        ...(room.state as any),
        hostGameSettings: { ...room.state.hostGameSettings, botDifficulty: resolvedBotDiff },
      };
    }
    room.configuredGameSettings = {
      ...(room.configuredGameSettings ?? {}),
      botDifficulty: resolvedBotDiff,
    };
    promoteConnectedHumanHost(room, playerId);
    clearRoomDisconnectGrace(room);
    room.state = withOnlineTurnDeadline(room.state);
    room.lastActivity = Date.now();

    emitRoomPlayers(io, room);
    broadcastState(io, room);
    scheduleRoomTurnTimer(io, room);
    scheduleBotAction(io, room);

    const playerView = getPlayerView(room.state, playerId, playerLocale(room, playerId));
    reply({ ok: true, playerView });
  });

  socket.on('create_class_session', (payload) => {
    if (rateLimited()) return;
    const result = createClassSession(payload, socket.id);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(classroomSocketRoom(result.sessionCode));
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('join_class_session', (payload) => {
    if (rateLimited()) return;
    const result = joinClassSession(payload, socket.id);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(classroomSocketRoom(result.sessionCode));
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('leave_class_session', () => {
    const binding = getClassroomBindingBySocket(socket.id);
    const result = leaveClassSession(socket.id);
    if (!binding || !result) return;
    socket.leave(classroomSocketRoom(binding.sessionCode));
    if (result.report) {
      emitClassroomClosed(io, result.sessionCode, result.report);
      return;
    }
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('classroom_update_group_status', (payload) => {
    if (rateLimited()) return;
    const result = updateClassroomGroupStatus(socket.id, payload);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('classroom_advance_round', (payload) => {
    if (rateLimited()) return;
    const result = advanceClassroomRound(socket.id, payload);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('classroom_send_intervention', (payload) => {
    if (rateLimited()) return;
    const result = sendClassroomIntervention(socket.id, payload);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('classroom_record_group_result', (payload) => {
    if (rateLimited()) return;
    const result = recordClassroomGroupResult(socket.id, payload);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    emitClassroomState(io, result.sessionCode);
  });

  socket.on('classroom_close_session', () => {
    if (rateLimited()) return;
    const result = closeClassSession(socket.id);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    emitClassroomState(io, result.sessionCode);
    emitClassroomClosed(io, result.sessionCode, result.report);
  });

  socket.on('begin_turn', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => beginTurn(state));
  });

  socket.on('resolve_overflow_swap', ({ handCardId, pileChoice }) => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId, { allowOverflowPending: true });
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) =>
      resolveOverflowSwap(state, handCardId ?? null, pileChoice ?? 'top'),
    );
  });

  socket.on('replace_card_with_wild', ({ cardId }) => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) return;
    applyAction(io, socket, room, playerId, (state) => {
      if (state.phase !== 'turn-transition') return { error: { key: 'game.invalidPhase' } };
      if ((state as any).wildAttemptedThisTurn) return { error: { key: 'game.invalidAction' } };
      const cp = state.players[state.currentPlayerIndex];
      if (!cp) return { error: { key: 'game.invalidAction' } };
      const replacedCard = cp.hand.find((c) => c.id === cardId);
      if (!replacedCard) return { error: { key: 'game.invalidAction' } };
      const newCard = { id: randomUUID(), type: 'wild' as const };
      return {
        ...state,
        players: state.players.map((pl, idx) =>
          idx === state.currentPlayerIndex
            ? { ...pl, hand: pl.hand.map((c) => (c.id === cardId ? newCard : c)) }
            : pl,
        ),
        discardPile: [...state.discardPile, replacedCard],
        wildAttemptedThisTurn: true,
      } as any;
    });
  });

  socket.on('replace_card_with_slinda', ({ cardId }) => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) return;
    applyAction(io, socket, room, playerId, (state) => {
      if (state.phase !== 'turn-transition') return { error: { key: 'game.invalidPhase' } };
      if ((state as any).slindaAttemptedThisTurn) return { error: { key: 'game.invalidAction' } };
      const cp = state.players[state.currentPlayerIndex];
      if (!cp) return { error: { key: 'game.invalidAction' } };
      const replacedCard = cp.hand.find((c) => c.id === cardId);
      if (!replacedCard) return { error: { key: 'game.invalidAction' } };
      const newCard = { id: randomUUID(), type: 'joker' as const };
      return {
        ...state,
        players: state.players.map((pl, idx) =>
          idx === state.currentPlayerIndex
            ? { ...pl, hand: pl.hand.map((c) => (c.id === cardId ? newCard : c)) }
            : pl,
        ),
        discardPile: [...state.discardPile, replacedCard],
        slindaAttemptedThisTurn: true,
      } as any;
    });
  });

  socket.on('set_bot_difficulty', ({ difficulty }) => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyBotDifficulty') });
      return;
    }
    if (!room.state) {
      socket.emit('error', { message: t(loc, 'game.notStarted') });
      return;
    }
    if (!hasBot(room)) {
      socket.emit('error', { message: t(loc, 'game.noBotInRoom') });
      return;
    }
    const diff = normalizeBotDifficulty(difficulty);
    if (!BOT_DIFF_LEVELS.includes(diff)) {
      socket.emit('error', { message: t(loc, 'game.invalidBotDifficulty') });
      return;
    }
    room.state = {
      ...room.state,
      hostGameSettings: {
        ...room.state.hostGameSettings,
        botDifficulty: diff,
      },
    };
    room.lastActivity = Date.now();
    broadcastState(io, room);
  });

  socket.on('roll_dice', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => doRollDice(state));
  });

  socket.on('confirm_equation', ({ result, equationDisplay, equationCommits, equationCommit }) => {
    if (rateLimited()) return;
    const safeDisplay = sanitizeEquationDisplay(equationDisplay);
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      socket.emit('error', { message: 'Invalid equation result' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) =>
      confirmEquation(state, result, safeDisplay, equationCommits, equationCommit),
    );
  });

  socket.on('stage_card', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => stageCard(state, cid));
  });

  socket.on('unstage_card', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => unstageCard(state, cid));
  });

  socket.on('confirm_staged', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => confirmStaged(state));
  });

  socket.on('place_identical', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playIdentical(state, cid));
  });

  socket.on('play_fraction', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playFraction(state, cid));
  });

  socket.on('defend_fraction_solve', ({ cardId, wildResolve }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    // wildResolve validation happens inside defendFractionSolve (gameEngine checks range)
    applyAction(io, socket, room, playerId, (state) => defendFractionSolve(state, cid, wildResolve));
  });

  socket.on('defend_fraction_penalty', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => defendFractionPenalty(state));
  });

  socket.on('play_operation', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playOperation(state, cid));
  });

  socket.on('play_joker', ({ cardId, chosenOperation }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    const op = validateOperation(chosenOperation);
    if (!cid || !op) {
      socket.emit('error', { message: 'Invalid card or operation' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playJoker(state, cid, op));
  });

  socket.on('draw_card', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => drawCard(state));
  });

  socket.on('end_turn', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => doEndTurn(state));
  });

  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    cleanupRateLimit(socket.id);
    const classroomResult = leaveClassSession(socket.id);
    if (classroomResult?.report) {
      emitClassroomClosed(io, classroomResult.sessionCode, classroomResult.report);
    } else if (classroomResult) {
      emitClassroomState(io, classroomResult.sessionCode);
    }
    const activeInfo = getRoomBySocket(socket.id);
    if (activeInfo?.room.state && activeInfo.room.state.phase !== 'game-over') {
      leaveRoom(socket.id);
      void handleActiveGameExit(io, activeInfo.room, activeInfo.playerId);
      return;
    }
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.state) {
      broadcastState(io, room);
      scheduleBotAction(io, room);
      if (shouldStartDisconnectGrace(room, playerId)) {
        const deadlineAt = setDisconnectGraceTimer(room, playerId, (timerRoom, disconnectedPlayerId) => {
          clearRoomTurnTimer(timerRoom);
          clearBotActionTimer(timerRoom);
          // Grace expired — opponent didn't return. End with technical
          // victory for the remaining player (no bot offer).
          if (timerRoom.state && timerRoom.state.phase !== 'game-over') {
            const tvResult = technicalVictory(timerRoom.state, disconnectedPlayerId);
            if (tvResult) {
              timerRoom.state = tvResult;
              broadcastState(io, timerRoom);
              emitRoomToasts(io, timerRoom);
              maybeRecordMatch(timerRoom);
              return;
            }
          }
          if (timerRoom.state) {
            timerRoom.state = { ...timerRoom.state, turnDeadlineAt: null };
            broadcastState(io, timerRoom);
          }
          const disconnectedPlayer = timerRoom.players.find((player) => player.id === disconnectedPlayerId);
          const disconnectedName = disconnectedPlayer?.name ?? 'Player';
          for (const other of timerRoom.players) {
            if (other.id === disconnectedPlayerId || other.isBot || !other.isConnected) continue;
            emitToPlayer(io, timerRoom, other.id, (peerSocket) => {
              peerSocket.emit('opponent_disconnect_expired', {
                playerId: disconnectedPlayerId,
                playerName: disconnectedName,
              });
            });
          }
        });

        for (const other of room.players) {
          if (other.id === playerId || other.isBot || !other.isConnected) continue;
          emitToPlayer(io, room, other.id, (peerSocket) => {
            peerSocket.emit('opponent_disconnect_grace', {
              playerId,
              playerName,
              deadlineAt,
            });
          });
        }
      }
    } else if (room.players.length > 0) {
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
      handleWaitingRoomRosterChange(io, room);
    } else {
      emitTablesUpdated(io);
    }
  });
}
