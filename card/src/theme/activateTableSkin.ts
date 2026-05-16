import type { TableSkinId } from './tableSkins';

export type SetActiveSkinFn = (
  kind: 'card_back' | 'table_theme' | 'table_skin',
  themeId: string,
) => Promise<'ok' | 'not_owned' | 'invalid' | 'error'>;

export async function activateTableSkin(
  setActiveSkin: SetActiveSkinFn,
  skinId: TableSkinId | 'none',
): Promise<'ok' | 'not_owned' | 'invalid' | 'error'> {
  const tableSkinResult = await setActiveSkin('table_skin', skinId);
  if (tableSkinResult !== 'ok' || skinId !== 'none') {
    return tableSkinResult;
  }

  const tableThemeResult = await setActiveSkin('table_theme', 'classic');
  if (tableThemeResult !== 'ok') {
    return tableThemeResult;
  }

  return setActiveSkin('card_back', 'classic');
}
