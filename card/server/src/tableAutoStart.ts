import type { Player } from '../../shared/types';

export function shouldAutoStartWhenRoomIsFull(input: {
  players: Pick<Player, 'isBot'>[];
  maxParticipants: number;
  state: unknown;
  configuredDifficulty: 'easy' | 'full' | null;
}): boolean {
  if (input.state || !input.configuredDifficulty) return false;
  const humanCount = input.players.filter((player) => !player.isBot).length;
  return humanCount >= input.maxParticipants;
}
