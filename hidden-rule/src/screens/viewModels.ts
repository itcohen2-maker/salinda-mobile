import * as React from 'react'

import type { ArchiveCardSpec, ArchiveCardState } from '../components/gameplay'

export type ScreenAction = {
  disabled?: boolean
  label: string
  onClick?: () => void
  strong?: boolean
}

export type ScreenNotice = {
  body: React.ReactNode
  label: string
  tone?: 'neutral' | 'accepted' | 'rejected'
}

export type GameplayViewModel = {
  actions: ScreenAction[]
  contradicts: Array<ArchiveCardSpec & { fresh?: boolean; motionKey?: string }>
  dimHand?: boolean
  focusCard?: ArchiveCardSpec & {
    helper?: string
    state?: ArchiveCardState
  }
  hand: ArchiveCardSpec[]
  motion?: {
    ledgerKey?: string
    readyKey?: string
    verdictKey?: string
  }
  notice?: ScreenNotice
  onBack?: () => void
  onMeta?: () => void
  onSelectCard?: (index: number) => void
  primaryAction: {
    disabled?: boolean
    label: string
    onClick?: () => void
    variant: 'primary' | 'premium'
  }
  prompt: React.ReactNode
  rail: {
    article: string
    chapter: string
    label: string
  }
  registerLit: number
  registerResolved?: boolean
  registerStatus: string
  registerTotal?: number
  remainingCount: number
  satisfies: Array<ArchiveCardSpec & { fresh?: boolean; motionKey?: string }>
  selectedIndex: number
  title: string
  verdict?: {
    catalog: string
    glyph: ArchiveCardSpec['glyph']
    result: 'accepted' | 'rejected'
  }
}

export type RuleNamingViewModel = {
  actions: ScreenAction[]
  counts: {
    contradicts: number
    satisfies: number
  }
  footer?: string
  initialPrompt: React.ReactNode
  introEyebrow: string
  left: ArchiveCardSpec
  motion?: {
    entryKey?: string
    submissionKey?: string
  }
  notice?: ScreenNotice
  onBack?: () => void
  onMeta?: () => void
  onSelectOption?: (id: string) => void
  options: Array<{
    id: string
    label: string
    selected?: boolean
  }>
  primaryAction: {
    disabled?: boolean
    label: string
    onClick?: () => void
  }
  rail: {
    article: string
    chapter: string
    label: string
  }
  right: ArchiveCardSpec
  selectedOptionId?: string
  title: string
}
