import React, { createContext, useContext } from 'react';
import { THEMES, DEFAULT_THEME_ID, type ThemeId, type TableTheme, type BackgroundTheme } from './themes';
import { TABLE_SKINS, type TableSkinId, type TableSkin } from './tableSkins';
import { useAuth } from '../hooks/useAuth';

export type { TableSkin };

export interface ActiveTheme {
  tableThemeId: ThemeId;
  backgroundThemeId: ThemeId;
  table: TableTheme;
  background: BackgroundTheme;
  activeTableSkin: TableSkin | null;
}

function resolveTheme(tableId: string, backgroundId: string, tableSkinId?: string | null): ActiveTheme {
  const resolvedTableThemeId = (THEMES[tableId as ThemeId]?.id ?? DEFAULT_THEME_ID) as ThemeId;
  const resolvedBackgroundThemeId = (THEMES[backgroundId as ThemeId]?.id ?? DEFAULT_THEME_ID) as ThemeId;
  const table = THEMES[resolvedTableThemeId]?.table ?? THEMES[DEFAULT_THEME_ID].table;
  const background = THEMES[resolvedBackgroundThemeId]?.background ?? THEMES[DEFAULT_THEME_ID].background;
  const activeTableSkin =
    tableSkinId && TABLE_SKINS[tableSkinId as TableSkinId]
      ? TABLE_SKINS[tableSkinId as TableSkinId]
      : null;
  return {
    tableThemeId: resolvedTableThemeId,
    backgroundThemeId: resolvedBackgroundThemeId,
    table,
    background,
    activeTableSkin,
  };
}

const ThemeContext = createContext<ActiveTheme>(resolveTheme(DEFAULT_THEME_ID, DEFAULT_THEME_ID));

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const tableId = profile?.active_table_theme ?? DEFAULT_THEME_ID;
  const backgroundId = profile?.active_card_back ?? DEFAULT_THEME_ID;
  const tableSkinId = profile?.active_table_skin ?? null;
  return (
    <ThemeContext.Provider value={resolveTheme(tableId, backgroundId, tableSkinId)}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useActiveTheme(): ActiveTheme {
  return useContext(ThemeContext);
}
