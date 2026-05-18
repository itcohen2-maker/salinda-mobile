export type DisguisedBotProfile = {
  displayName: string;
  clanTag: string | null;
  fakePing: number; // initial value in ms, 45–85
};

const FIRST_NAMES = [
  'Alex', 'Sam', 'Dana', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Taylor',
  'Avery', 'Jamie', 'Quinn', 'Skyler', 'Reese', 'Finley', 'Drew',
];

const SUFFIXES = [
  '47', '23', '99', '11', '88', '55', '77',
  '_NJ', '_Pro', 'K', 'X', '_G', '_Ace', 'Pro', 'GG',
];

const CLAN_TAGS: (string | null)[] = [
  null, null, null,
  '[ALPHA]', '[PHX]', '[NOVA]', '[ACE]', '[APEX]',
];

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateDisguisedProfile(): DisguisedBotProfile {
  const name = randItem(FIRST_NAMES);
  const suffix = randItem(SUFFIXES);
  return {
    displayName: `${name}${suffix}`,
    clanTag: randItem(CLAN_TAGS),
    fakePing: 45 + Math.floor(Math.random() * 41), // 45–85
  };
}

/** Call each bot turn to simulate ping fluctuation. Clamps to [30, 120]. */
export function jitterPing(currentPing: number): number {
  const delta = Math.floor(Math.random() * 11) - 5; // -5 to +5
  return Math.max(30, Math.min(120, currentPing + delta));
}
