import { generateDisguisedProfile, jitterPing } from '../botDisguise';

describe('generateDisguisedProfile', () => {
  it('returns a non-empty displayName that does not contain "Bot" or "בוט"', () => {
    const profile = generateDisguisedProfile();
    expect(profile.displayName).toBeTruthy();
    expect(profile.displayName).not.toContain('Bot');
    expect(profile.displayName).not.toContain('בוט');
  });

  it('returns fakePing in range [45, 85]', () => {
    for (let i = 0; i < 30; i++) {
      const profile = generateDisguisedProfile();
      expect(profile.fakePing).toBeGreaterThanOrEqual(45);
      expect(profile.fakePing).toBeLessThanOrEqual(85);
    }
  });

  it('clanTag is either null or a bracketed string like [TAG]', () => {
    const tags = new Set<string | null>();
    for (let i = 0; i < 50; i++) {
      tags.add(generateDisguisedProfile().clanTag);
    }
    for (const tag of tags) {
      if (tag !== null) {
        expect(tag).toMatch(/^\[.+\]$/);
      }
    }
  });

  it('generates varied displayNames across calls', () => {
    const names = new Set(Array.from({ length: 30 }, () => generateDisguisedProfile().displayName));
    expect(names.size).toBeGreaterThan(5);
  });
});

describe('jitterPing', () => {
  it('stays in [30, 120] range', () => {
    for (let i = 0; i < 50; i++) {
      const result = jitterPing(60);
      expect(result).toBeGreaterThanOrEqual(30);
      expect(result).toBeLessThanOrEqual(120);
    }
  });

  it('clamps at 30 when input is very low', () => {
    // With delta range [-5, +5] and input 28, worst case is 28-5=23 → clamped to 30
    for (let i = 0; i < 20; i++) {
      expect(jitterPing(28)).toBeGreaterThanOrEqual(30);
    }
  });

  it('clamps at 120 when input is very high', () => {
    for (let i = 0; i < 20; i++) {
      expect(jitterPing(122)).toBeLessThanOrEqual(120);
    }
  });
});
