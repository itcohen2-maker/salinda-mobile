import { resolveTableSkinId } from './tableSkins';

describe('resolveTableSkinId', () => {
  it('keeps current table skin ids unchanged', () => {
    expect(resolveTableSkinId('poker_gold')).toBe('poker_gold');
  });

  it('maps legacy classic green table values to the current default skin', () => {
    expect(resolveTableSkinId('classic_green')).toBe('poker_red');
    expect(resolveTableSkinId('green')).toBe('poker_red');
  });

  it('drops unknown or empty values', () => {
    expect(resolveTableSkinId('classic')).toBeNull();
    expect(resolveTableSkinId(null)).toBeNull();
  });
});
