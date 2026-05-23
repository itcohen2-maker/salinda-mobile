import { tutorialBus } from '../tutorialBus';

describe('L4.1 → L4.2 hand cleanup', () => {
  beforeEach(() => {
    tutorialBus.setL4Config({ pickA: 0, pickB: 1, target: 5, hand: [1, 2, 3, 4, 5] });
  });

  it('hand contains target before cleanup', () => {
    expect(tutorialBus.getL4Config()?.hand).toContain(5);
  });

  it('hand does NOT contain target after filter', () => {
    const cfg = tutorialBus.getL4Config()!;
    tutorialBus.setL4Config({ ...cfg, hand: cfg.hand!.filter((v) => v !== 5) });
    expect(tutorialBus.getL4Config()?.hand).not.toContain(5);
  });

  it('all other cards remain after filter', () => {
    const cfg = tutorialBus.getL4Config()!;
    tutorialBus.setL4Config({ ...cfg, hand: cfg.hand!.filter((v) => v !== 5) });
    expect(tutorialBus.getL4Config()?.hand).toEqual([1, 2, 3, 4]);
  });
});
