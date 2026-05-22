import * as React from 'react'

import type { ArchiveCardSpec } from '../components/gameplay'

export type GameplayVariant = 'idle' | 'after-check' | 'ready-to-name'

export type GameplayScreenState = {
  actions: Array<{ disabled?: boolean; label: string; strong?: boolean }>
  contradicts: Array<ArchiveCardSpec & { fresh?: boolean }>
  hand: ArchiveCardSpec[]
  primaryLabel: string
  primaryVariant: 'primary' | 'premium'
  prompt: React.ReactNode
  registerLit: number
  registerResolved?: boolean
  registerStatus: string
  remainingCount: number
  satisfies: Array<ArchiveCardSpec & { fresh?: boolean }>
  selectedIndex: number
  title: string
  verdict?: {
    catalog: string
    glyph: ArchiveCardSpec['glyph']
    result: 'accepted' | 'rejected'
  }
}

export const GAMEPLAY_STATES: Record<GameplayVariant, GameplayScreenState> = {
  idle: {
    actions: [
      { label: 'רמז' },
      { label: 'וותר' },
    ],
    contradicts: [],
    hand: [
      { catalog: 'II-11', glyph: 'paired-bars' },
      { catalog: 'III-04', glyph: 'cut-diamond' },
      { catalog: 'III-09', glyph: 'ring-axis' },
    ],
    primaryLabel: 'בחר קלף לבדיקה',
    primaryVariant: 'primary',
    prompt: <>מצא מה משותף לקלפים התואמים.</>,
    registerLit: 0,
    registerStatus: 'ממתין לבדיקה הראשונה',
    remainingCount: 5,
    satisfies: [],
    selectedIndex: -1,
    title: 'הסדר ההדדי',
  },
  'after-check': {
    actions: [
      { label: 'רמז' },
      { label: 'נסח את הכלל', disabled: true },
    ],
    contradicts: [
      { catalog: 'III-04', glyph: 'cut-diamond', fresh: true },
    ],
    hand: [
      { catalog: 'II-11', glyph: 'paired-bars' },
      { catalog: 'II-17', glyph: 'triple-notch' },
      { catalog: 'III-09', glyph: 'ring-axis' },
    ],
    primaryLabel: 'בדוק את הקלף',
    primaryVariant: 'primary',
    prompt: (
      <>
        הקלף <em>III-04</em> סותר את הכלל.
      </>
    ),
    registerLit: 2,
    registerStatus: 'מתגבש / 2 מתוך 6',
    remainingCount: 4,
    satisfies: [
      { catalog: 'I-04', glyph: 'ring-axis' },
      { catalog: 'II-03', glyph: 'ladder-rungs' },
    ],
    selectedIndex: 1,
    title: 'הסדר ההדדי',
    verdict: {
      catalog: 'III-04',
      glyph: 'cut-diamond',
      result: 'rejected',
    },
  },
  'ready-to-name': {
    actions: [
      { label: 'עוד בדיקה' },
      { label: 'וותר' },
    ],
    contradicts: [
      { catalog: 'III-04', glyph: 'cut-diamond' },
      { catalog: 'II-17', glyph: 'triple-notch' },
      { catalog: 'II-06', glyph: 'paired-bars', fresh: true },
    ],
    hand: [
      { catalog: 'II-11', glyph: 'paired-bars' },
      { catalog: 'IV-02', glyph: 'tally-seal' },
      { catalog: 'III-09', glyph: 'ring-axis' },
    ],
    primaryLabel: 'נסח את הכלל',
    primaryVariant: 'premium',
    prompt: (
      <>
        <em>יש די ראיות.</em> הכלל קריא.
      </>
    ),
    registerLit: 6,
    registerResolved: true,
    registerStatus: 'נפתר / מוכן לניסוח',
    remainingCount: 3,
    satisfies: [
      { catalog: 'I-04', glyph: 'ring-axis' },
      { catalog: 'II-03', glyph: 'ladder-rungs' },
      { catalog: 'III-11', glyph: 'nested-arc' },
      { catalog: 'IV-02', glyph: 'tally-seal' },
    ],
    selectedIndex: -1,
    title: 'הסדר ההדדי',
  },
}
