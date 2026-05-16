import { activateTableSkin, type SetActiveSkinFn } from './activateTableSkin';

function createSetActiveSkinMock(
  implementation?: (kind: Parameters<SetActiveSkinFn>[0], themeId: string) => ReturnType<SetActiveSkinFn>,
) {
  return jest.fn<ReturnType<SetActiveSkinFn>, Parameters<SetActiveSkinFn>>(
    implementation ??
      (async () => 'ok'),
  );
}

describe('activateTableSkin', () => {
  it('resets the classic table and background when removing a table skin', async () => {
    const setActiveSkin = createSetActiveSkinMock();

    const result = await activateTableSkin(setActiveSkin, 'none');

    expect(result).toBe('ok');
    expect(setActiveSkin.mock.calls).toEqual([
      ['table_skin', 'none'],
      ['table_theme', 'classic'],
      ['card_back', 'classic'],
    ]);
  });

  it('only updates the equipped skin when activating a purchased table skin', async () => {
    const setActiveSkin = createSetActiveSkinMock();

    const result = await activateTableSkin(setActiveSkin, 'poker_red');

    expect(result).toBe('ok');
    expect(setActiveSkin.mock.calls).toEqual([['table_skin', 'poker_red']]);
  });

  it('stops immediately when clearing the table skin fails', async () => {
    const setActiveSkin = createSetActiveSkinMock(async (kind) =>
      kind === 'table_skin' ? 'error' : 'ok',
    );

    const result = await activateTableSkin(setActiveSkin, 'none');

    expect(result).toBe('error');
    expect(setActiveSkin.mock.calls).toEqual([['table_skin', 'none']]);
  });

  it('stops before resetting the background when restoring the classic table fails', async () => {
    const setActiveSkin = createSetActiveSkinMock(async (kind) => {
      if (kind === 'table_theme') return 'error';
      return 'ok';
    });

    const result = await activateTableSkin(setActiveSkin, 'none');

    expect(result).toBe('error');
    expect(setActiveSkin.mock.calls).toEqual([
      ['table_skin', 'none'],
      ['table_theme', 'classic'],
    ]);
  });
});
