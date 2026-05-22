import * as React from 'react'

import {
  ACCENT_TOKENS,
  BRASS_TOKENS,
  buildTransition,
  FONT_STACKS,
  MOTION_STAGGER_MS,
  SHADOW_TOKENS,
  SURFACE_TOKENS,
  TEXT_COLORS,
} from '../../theme'
import { IconButton } from '../buttons'
import { RuleGlyph, type RuleGlyphId } from './RuleGlyph'

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

export type ArchiveCardState =
  | 'neutral'
  | 'selected'
  | 'trial'
  | 'accepted'
  | 'rejected'
  | 'dim'

export type ArchiveCardSpec = {
  catalog: string
  glyph: RuleGlyphId
}

export type EvidenceEntry = ArchiveCardSpec & {
  fresh?: boolean
  motionKey?: string
}

function alpha(hex: string, opacity: number) {
  const source = hex.replace('#', '')
  const normalized = source.length === 3
    ? source.split('').map((char) => char + char).join('')
    : source

  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

function createPanelStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    position: 'relative',
    borderRadius: 20,
    padding: '16px 16px 14px',
    background:
      'linear-gradient(180deg, rgba(28, 33, 40, 0.94) 0%, rgba(20, 22, 27, 0.94) 100%)',
    boxShadow:
      'inset 0 0 0 1px rgba(236, 228, 208, 0.10), inset 0 1px 0 rgba(236, 228, 208, 0.05), 0 12px 30px rgba(6, 8, 12, 0.22)',
    ...extra,
  }
}

function createMetaLabelStyle(): React.CSSProperties {
  return {
    fontFamily: serifFontFamily,
    fontSize: 10,
    lineHeight: 1.2,
    letterSpacing: '0.20em',
    textTransform: 'uppercase',
    color: alpha(BRASS_TOKENS.soft, 0.82),
    fontWeight: 500,
  }
}

function useEntranceMotion(delayMs = 0) {
  const [entered, setEntered] = React.useState(false)

  React.useEffect(() => {
    const timer = globalThis.setTimeout(() => setEntered(true), delayMs)
    return () => globalThis.clearTimeout(timer)
  }, [delayMs])

  return entered
}

function useTriggeredMotion(triggerKey?: string, durationMs = 520) {
  const [active, setActive] = React.useState(false)
  const previousKeyRef = React.useRef<string | undefined>(undefined)

  React.useEffect(() => {
    if (!triggerKey) {
      previousKeyRef.current = undefined
      setActive(false)
      return
    }

    if (previousKeyRef.current === triggerKey) {
      return
    }

    previousKeyRef.current = triggerKey
    setActive(true)

    const timer = globalThis.setTimeout(() => setActive(false), durationMs)
    return () => globalThis.clearTimeout(timer)
  }, [durationMs, triggerKey])

  return active
}

export function ChapterRail({
  article = '04',
  chapter = 'III',
  label = 'יומן הפיצוח',
  onBack,
  onMeta,
  title = 'הסדר ההדדי',
}: {
  article?: string
  chapter?: string
  label?: string
  onBack?: () => void
  onMeta?: () => void
  title?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, direction: 'rtl' }}>
      <IconButton icon="back" label="חזרה" size="compact" onClick={onBack} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={createMetaLabelStyle()}>{`פרק ${chapter} / סעיף ${article}`}</div>
        <div
          style={{
            marginTop: 4,
            fontFamily: serifFontFamily,
            fontSize: 14,
            lineHeight: 1.3,
            fontStyle: 'italic',
            color: alpha(TEXT_COLORS.secondary, 0.88),
          }}
        >
          {title}
        </div>
      </div>
      <IconButton icon="rules" label={label} size="compact" onClick={onMeta} />
    </div>
  )
}

export function PromptBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={createPanelStyle({
        padding: '14px 16px',
        background:
          'linear-gradient(180deg, rgba(35, 42, 51, 0.92) 0%, rgba(22, 26, 33, 0.94) 100%)',
      })}
    >
      <div
        style={{
          fontFamily: serifFontFamily,
          fontSize: 17,
          lineHeight: 1.5,
          fontStyle: 'italic',
          color: alpha(TEXT_COLORS.primary, 0.88),
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function FocusCardStage({
  card,
}: {
  card: ArchiveCardSpec & {
    helper?: string
    state?: ArchiveCardState
  }
}) {
  return (
    <div
      style={createPanelStyle({
        padding: '16px 16px 14px',
        background:
          'radial-gradient(120% 96% at 50% 18%, rgba(62, 74, 92, 0.16) 0%, rgba(24, 29, 36, 0.94) 48%, rgba(15, 18, 24, 0.98) 100%)',
      })}
    >
      <div style={{ ...createMetaLabelStyle(), marginBottom: 10, textAlign: 'center' }}>תצוגה מוגדלת</div>
      <div
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 10,
        }}
      >
        <ArchiveCard
          catalog={card.catalog}
          glyph={card.glyph}
          size="md"
          state={card.state ?? 'selected'}
        />
        <div
          style={{
            fontFamily: serifFontFamily,
            fontSize: 13,
            lineHeight: 1.45,
            fontStyle: 'italic',
            color: alpha(TEXT_COLORS.secondary, 0.72),
            textAlign: 'center',
            maxWidth: 220,
          }}
        >
          {card.helper ?? 'כך הסמל נראה בגודל קריא יותר.'}
        </div>
      </div>
    </div>
  )
}

export function ArchiveCard({
  catalog,
  glyph,
  size = 'md',
  state = 'neutral',
}: {
  catalog: string
  glyph: RuleGlyphId
  size?: 'sm' | 'md'
  state?: ArchiveCardState
}) {
  const dimensions = size === 'sm'
    ? { width: 98, height: 144, glyph: 48, radius: 15, padding: 8, rail: 15, plaque: 18 }
    : { width: 126, height: 188, glyph: 62, radius: 18, padding: 10, rail: 20, plaque: 22 }

  const isSelected = state === 'selected'
  const isAccepted = state === 'accepted'
  const isRejected = state === 'rejected'
  const isTrial = state === 'trial'
  const isDim = state === 'dim'

  const accent = isRejected
    ? ACCENT_TOKENS.oxblood
    : isAccepted
      ? BRASS_TOKENS.soft
      : isSelected
        ? '#7386A1'
        : BRASS_TOKENS.dark

  const outerBackground = isRejected
    ? `linear-gradient(180deg, ${alpha(ACCENT_TOKENS.oxblood, 0.58)} 0%, rgba(19, 14, 17, 0.98) 100%)`
    : isAccepted
      ? `linear-gradient(180deg, ${alpha(BRASS_TOKENS.soft, 0.68)} 0%, rgba(17, 20, 27, 0.98) 100%)`
      : isSelected
        ? 'linear-gradient(180deg, rgba(104, 122, 150, 0.82) 0%, rgba(22, 27, 35, 0.98) 100%)'
        : 'linear-gradient(180deg, rgba(129, 104, 67, 0.44) 0%, rgba(20, 24, 31, 0.98) 100%)'

  const innerBackground = isTrial
    ? 'radial-gradient(120% 92% at 50% 24%, rgba(110, 128, 154, 0.18) 0%, transparent 56%), linear-gradient(180deg, rgba(34, 42, 52, 0.98) 0%, rgba(14, 17, 23, 1) 100%)'
    : isSelected
      ? 'radial-gradient(120% 92% at 50% 24%, rgba(122, 148, 186, 0.20) 0%, transparent 56%), linear-gradient(180deg, rgba(33, 41, 52, 0.98) 0%, rgba(13, 16, 22, 1) 100%)'
      : 'radial-gradient(120% 92% at 50% 24%, rgba(104, 88, 56, 0.14) 0%, transparent 56%), linear-gradient(180deg, rgba(29, 35, 44, 0.98) 0%, rgba(13, 16, 21, 1) 100%)'

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: dimensions.width,
    height: dimensions.height,
    borderRadius: dimensions.radius,
    padding: 1.25,
    boxSizing: 'border-box',
    background: outerBackground,
    boxShadow: isDim
      ? '0 8px 20px rgba(6, 8, 12, 0.12)'
      : isSelected
        ? '0 22px 42px rgba(6, 8, 12, 0.34), 0 0 0 1px rgba(236, 228, 208, 0.04)'
        : '0 18px 38px rgba(6, 8, 12, 0.28), 0 0 0 1px rgba(236, 228, 208, 0.03)',
    filter: isDim ? 'saturate(0.78) brightness(0.82)' : undefined,
    opacity: isDim ? 0.46 : 1,
    transition: buildTransition(['box-shadow', 'filter', 'opacity', 'background', 'transform'], 'm', 'settle'),
    transform: isSelected ? 'translateY(-1px)' : 'translateY(0)',
  }

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: dimensions.radius - 2,
    background: innerBackground,
    boxShadow:
      `inset 0 0 0 1px ${alpha('#EDE4D3', 0.14)}, inset 0 1px 0 ${alpha('#EDE4D3', 0.05)}, inset 0 -1px 0 rgba(0, 0, 0, 0.56)`,
    overflow: 'hidden',
  }

  const chamberRadius = size === 'sm' ? 12 : 14
  const chamberInset = size === 'sm' ? 6 : 8
  const chamberGlyphTone = isRejected ? 'oxblood' : isAccepted ? 'brass' : 'ivory'

  return (
    <div style={cardStyle}>
      <div style={innerStyle}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 6,
            borderRadius: dimensions.radius - 6,
            border: `1px solid ${alpha(accent, isSelected ? 0.18 : 0.12)}`,
            pointerEvents: 'none',
          }}
        />
        {[
          { left: 7, top: 7, rotate: '0deg' },
          { right: 7, top: 7, rotate: '90deg' },
          { right: 7, bottom: 7, rotate: '180deg' },
          { left: 7, bottom: 7, rotate: '270deg' },
        ].map((corner, index) => (
          <span
            key={index}
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: size === 'sm' ? 10 : 12,
              height: size === 'sm' ? 10 : 12,
              borderTop: `1px solid ${alpha(BRASS_TOKENS.soft, 0.52)}`,
              borderLeft: `1px solid ${alpha(BRASS_TOKENS.soft, 0.52)}`,
              transform: `rotate(${corner.rotate})`,
              ...corner,
            }}
          />
        ))}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: dimensions.rail,
            background:
              'linear-gradient(180deg, rgba(14, 17, 23, 0.78) 0%, rgba(8, 10, 14, 0.92) 100%)',
            borderRight: `1px solid ${alpha(BRASS_TOKENS.soft, isSelected ? 0.48 : 0.24)}`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 8,
              bottom: 8,
              width: 1,
              transform: 'translateX(-50%)',
              background: `linear-gradient(180deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.86)} 18%, ${alpha(BRASS_TOKENS.soft, 0.66)} 84%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
            }}
          />
          {[0.13, 0.25, 0.38, 0.52, 0.67, 0.82].map((position, index) => (
            <span
              key={position}
              style={{
                position: 'absolute',
                left: '50%',
                top: `${position * 100}%`,
                width: index === 2 || index === 3 ? 12 : 8,
                height: index === 2 || index === 3 ? 1.6 : 1.2,
                transform: 'translate(-50%, -50%)',
                borderRadius: 999,
                background:
                  isSelected && (index === 2 || index === 3)
                    ? alpha(TEXT_COLORS.primary, 0.94)
                    : alpha(BRASS_TOKENS.soft, 0.52),
                boxShadow:
                  isSelected && (index === 2 || index === 3)
                    ? `0 0 10px ${alpha(BRASS_TOKENS.soft, 0.28)}`
                    : undefined,
                transition: buildTransition(['background', 'box-shadow', 'width'], 's', 'register'),
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            inset: dimensions.padding,
            left: dimensions.padding + dimensions.rail - 4,
            display: 'flex',
            flexDirection: 'column',
            gap: size === 'sm' ? 7 : 9,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontFamily: serifFontFamily,
                fontSize: size === 'sm' ? 6 : 7,
                lineHeight: 1.15,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: alpha(TEXT_COLORS.secondary, 0.44),
                fontWeight: 500,
              }}
            >
              hidden rule
            </div>
            <div
              style={{
                padding: size === 'sm' ? '2px 5px' : '2px 6px',
                borderRadius: 999,
                background: `linear-gradient(180deg, ${alpha(BRASS_TOKENS.dark, 0.24)} 0%, ${alpha('#0F1217', 0.62)} 100%)`,
                boxShadow: `inset 0 0 0 1px ${alpha(BRASS_TOKENS.soft, 0.18)}`,
                fontFamily: serifFontFamily,
                fontSize: size === 'sm' ? 6 : 7,
                lineHeight: 1.1,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: alpha(BRASS_TOKENS.soft, 0.82),
                fontWeight: 500,
              }}
            >
              {catalog}
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0.82)} 0%, ${alpha(BRASS_TOKENS.soft, 0.14)} 58%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
            }}
          />

          <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                borderRadius: chamberRadius,
              background:
                isSelected
                  ? 'radial-gradient(92% 90% at 50% 28%, rgba(118, 138, 173, 0.14) 0%, transparent 62%), linear-gradient(180deg, rgba(30, 38, 49, 0.92) 0%, rgba(15, 18, 24, 0.98) 100%)'
                  : 'radial-gradient(92% 90% at 50% 28%, rgba(168, 138, 88, 0.08) 0%, transparent 62%), linear-gradient(180deg, rgba(26, 31, 38, 0.94) 0%, rgba(14, 17, 22, 0.98) 100%)',
              boxShadow:
                `inset 0 0 0 1px ${alpha('#EDE4D3', 0.08)}, inset 0 18px 20px -16px ${alpha('#EDE4D3', 0.05)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: chamberInset,
                borderRadius: chamberRadius - 3,
                clipPath: 'polygon(8% 0, 92% 0, 100% 10%, 100% 90%, 92% 100%, 8% 100%, 0 90%, 0 10%)',
                background:
                  'linear-gradient(180deg, rgba(236, 228, 211, 0.08) 0%, rgba(17, 21, 27, 0.08) 100%)',
                boxShadow:
                  `inset 0 0 0 1px ${alpha(BRASS_TOKENS.soft, 0.16)}, inset 0 14px 18px -16px ${alpha('#EDE4D3', 0.12)}`,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: chamberInset + 8,
                right: chamberInset + 8,
                top: chamberInset + 7,
                height: 1,
                background: `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.74)} 24%, ${alpha(BRASS_TOKENS.soft, 0.22)} 76%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: chamberInset + 8,
                right: chamberInset + 8,
                bottom: chamberInset + 7,
                height: 1,
                background: `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.22)} 24%, ${alpha(BRASS_TOKENS.soft, 0.74)} 76%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
              }}
            />
            {[
              { left: chamberInset + 11, top: chamberInset + 11 },
              { right: chamberInset + 11, top: chamberInset + 11 },
              { right: chamberInset + 11, bottom: chamberInset + 11 },
              { left: chamberInset + 11, bottom: chamberInset + 11 },
            ].map((dot, index) => (
              <span
                key={index}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 3.5,
                  height: 3.5,
                  borderRadius: 999,
                  background: alpha(BRASS_TOKENS.soft, 0.74),
                  boxShadow: `0 0 0 2px ${alpha('#0F1217', 0.74)}`,
                  ...dot,
                }}
              />
            ))}
            <RuleGlyph
              id={glyph}
              size={dimensions.glyph}
              tone={chamberGlyphTone}
            />

            {isTrial ? (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: chamberInset - 2,
                  borderRadius: chamberRadius + 2,
                  border: `1px solid ${alpha(TEXT_COLORS.primary, 0.10)}`,
                }}
              />
            ) : null}

            {isAccepted ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: chamberInset + 6,
                    right: chamberInset + 6,
                    bottom: chamberInset + 5,
                    height: 1.6,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.94)} 24%, ${alpha(BRASS_TOKENS.soft, 0.94)} 76%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
                    transition: buildTransition(['opacity', 'transform'], 'l', 'draw'),
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: chamberInset + 1,
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: BRASS_TOKENS.soft,
                    boxShadow: `0 0 0 2px ${alpha('#0B0D11', 0.74)}`,
                  }}
                />
              </>
            ) : null}

            {isRejected ? (
              <>
                <svg
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: chamberInset + 2,
                    width: 'auto',
                    height: 'auto',
                  }}
                >
                  <line
                    x1="18"
                    y1="22"
                    x2="82"
                    y2="78"
                    stroke={alpha(ACCENT_TOKENS.oxblood, 0.92)}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    right: chamberInset + 4,
                    top: chamberInset + 4,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    border: `1px solid ${alpha(ACCENT_TOKENS.oxblood, 0.85)}`,
                  }}
                />
              </>
            ) : null}
          </div>

          <div
            style={{
              height: dimensions.plaque,
              borderRadius: size === 'sm' ? 10 : 12,
              background:
                isSelected
                  ? 'linear-gradient(180deg, rgba(37, 46, 58, 0.98) 0%, rgba(15, 18, 24, 0.98) 100%)'
                  : 'linear-gradient(180deg, rgba(27, 32, 39, 0.98) 0%, rgba(13, 16, 22, 0.98) 100%)',
              boxShadow: `inset 0 0 0 1px ${alpha(BRASS_TOKENS.soft, 0.14)}, inset 0 1px 0 ${alpha('#EDE4D3', 0.04)}`,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center',
              gap: 8,
              padding: size === 'sm' ? '0 8px' : '0 10px',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: size === 'sm' ? 6 : 7,
                height: size === 'sm' ? 6 : 7,
                borderRadius: 999,
                background: alpha(accent, isSelected ? 0.92 : 0.72),
                boxShadow: `0 0 0 2px ${alpha('#0E1116', 0.72)}`,
              }}
            />
            <div
              style={{
                fontFamily: serifFontFamily,
                fontSize: size === 'sm' ? 6 : 7,
                lineHeight: 1.1,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: alpha(TEXT_COLORS.secondary, 0.72),
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              archive specimen
            </div>
            <span
              aria-hidden="true"
              style={{
                width: size === 'sm' ? 14 : 18,
                height: 1.2,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.82)} 100%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function HandPanel({
  cards,
  count,
  dim,
  onSelectCard,
  selectedIndex,
}: {
  cards: ArchiveCardSpec[]
  count: number
  dim?: boolean
  onSelectCard?: (index: number) => void
  selectedIndex: number
}) {
  return (
    <div style={createPanelStyle()}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={createMetaLabelStyle()}>היד שלך</div>
        <div
          style={{
            fontFamily: serifFontFamily,
            fontSize: 13,
            lineHeight: 1.2,
            fontStyle: 'italic',
            color: alpha(TEXT_COLORS.secondary, 0.66),
          }}
        >
          {`${count} קלפים נותרו`}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 172,
          transition: buildTransition(['opacity', 'filter'], 'l', 'resolve'),
          opacity: dim ? 0.46 : 1,
          filter: dim ? 'saturate(0.78)' : undefined,
        }}
      >
        {cards.map((card, index) => {
          const offset = (index - (cards.length - 1) / 2) * 82
          const rotate = index === 0 ? -8 : index === cards.length - 1 ? 8 : 0
          const isSelected = index === selectedIndex
          const wrapperTransform = `translateX(${offset}px) translateY(${isSelected ? -8 : dim ? 8 : 0}px) rotate(${rotate}deg)`

          return (
            <button
              key={`${card.catalog}-${card.glyph}`}
              aria-label={`בחר ${card.catalog}`}
              aria-pressed={isSelected || undefined}
              type="button"
              disabled={dim || !onSelectCard}
              onClick={() => onSelectCard?.(index)}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                padding: 0,
                position: 'absolute',
                left: '50%',
                top: 6,
                marginLeft: -48,
                transform: wrapperTransform,
                transformOrigin: '50% 100%',
                transition: buildTransition(['transform', 'opacity'], isSelected ? 's' : 'm', isSelected ? 'lift' : 'settle'),
                cursor: dim || !onSelectCard ? 'default' : 'pointer',
              }}
            >
              <ArchiveCard
                catalog={card.catalog}
                glyph={card.glyph}
                size="sm"
                state={isSelected ? 'selected' : dim ? 'dim' : 'neutral'}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function VerdictBand({
  catalog,
  glyph,
  motionKey,
  result,
}: {
  catalog: string
  glyph: RuleGlyphId
  motionKey?: string
  result: 'accepted' | 'rejected'
}) {
  const entered = useTriggeredMotion(motionKey, 620)
  const tone = result === 'accepted' ? BRASS_TOKENS.soft : ACCENT_TOKENS.oxblood

  return (
    <div
      style={{
        ...createPanelStyle({
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto 1fr',
          gap: 12,
          alignItems: 'center',
          transform: entered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: entered
            ? `inset 0 0 0 1px ${alpha(tone, 0.16)}, 0 18px 30px rgba(6, 8, 12, 0.2)`
            : undefined,
          transition: buildTransition(['transform', 'box-shadow'], 'l', 'resolve'),
        }),
      }}
    >
      <span
        aria-hidden="true"
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${alpha(tone, 0)} 0%, ${alpha(tone, 0.9)} 100%)`,
        }}
      />
      <RuleGlyph id={glyph} size={30} tone={result === 'accepted' ? 'brass' : 'ivory'} />
      <div
        style={{
          fontFamily: serifFontFamily,
          fontSize: 14,
          lineHeight: 1.4,
          color: alpha(TEXT_COLORS.primary, 0.86),
          textAlign: 'center',
        }}
      >
        <em style={{ color: alpha(TEXT_COLORS.primary, 0.92) }}>{catalog}</em>
        <div style={{ marginTop: 2, fontSize: 12, color: alpha(TEXT_COLORS.secondary, 0.68) }}>
          {result === 'accepted' ? 'מתאים לחוק' : 'לא מתאים לחוק'}
        </div>
      </div>
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: tone,
          boxShadow: `0 0 0 2px ${alpha('#0B0D11', 0.72)}`,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${alpha(tone, 0.9)} 0%, ${alpha(tone, 0)} 100%)`,
        }}
      />
    </div>
  )
}

function EvidenceChip({
  entry,
  result,
}: {
  entry?: EvidenceEntry
  result: 'accepted' | 'rejected'
}) {
  if (!entry) {
    return (
      <div
        style={{
          height: 82,
          borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(18, 21, 27, 0.54) 0%, rgba(12, 14, 18, 0.42) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.05)',
        }}
      />
    )
  }

  const tone = result === 'accepted' ? BRASS_TOKENS.soft : ACCENT_TOKENS.oxblood
  const activeMotion = useTriggeredMotion(entry.motionKey, 720)

  return (
    <div
      style={{
        position: 'relative',
        height: 82,
        borderRadius: 16,
        padding: '10px 11px',
        boxSizing: 'border-box',
        background:
          result === 'accepted'
            ? `linear-gradient(180deg, ${alpha(BRASS_TOKENS.dark, 0.34)} 0%, rgba(20, 22, 27, 0.96) 100%)`
            : `linear-gradient(180deg, ${alpha(ACCENT_TOKENS.oxblood, 0.24)} 0%, rgba(20, 22, 27, 0.96) 100%)`,
        boxShadow: activeMotion
          ? `inset 0 0 0 1px ${alpha(tone, 0.44)}, 0 0 0 1px ${alpha(tone, 0.14)}, 0 18px 28px rgba(6, 8, 12, 0.22)`
          : 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), 0 6px 14px rgba(6, 8, 12, 0.14)',
        transform: activeMotion ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
        transition: buildTransition(['transform', 'box-shadow'], 'l', 'register'),
      }}
    >
      <div
        style={{
          fontFamily: serifFontFamily,
          fontSize: 9,
          lineHeight: 1.2,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: alpha(TEXT_COLORS.secondary, 0.58),
          marginBottom: 8,
        }}
      >
        {entry.catalog}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <RuleGlyph id={entry.glyph} size={34} tone="ivory" />
      </div>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 10,
          height: 1.4,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${alpha(tone, 0)} 0%, ${alpha(tone, 0.9)} 32%, ${alpha(tone, 0.9)} 68%, ${alpha(tone, 0)} 100%)`,
        }}
      />
    </div>
  )
}

export function LedgerPanel({
  contradicts,
  motionKey,
  satisfies,
  slotsPerColumn = 4,
}: {
  contradicts: EvidenceEntry[]
  motionKey?: string
  satisfies: EvidenceEntry[]
  slotsPerColumn?: number
}) {
  const activeMotion = useTriggeredMotion(motionKey, 700)
  const padEntries = React.useCallback(
    (entries: EvidenceEntry[]) => {
      const nextEntries: Array<EvidenceEntry | undefined> = [...entries]
      while (nextEntries.length < slotsPerColumn) {
        nextEntries.push(undefined)
      }

      return nextEntries.slice(0, slotsPerColumn)
    },
    [slotsPerColumn],
  )

  const acceptedEntries = padEntries(satisfies)
  const rejectedEntries = padEntries(contradicts)

  return (
    <div
      style={createPanelStyle({
        transform: activeMotion ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: activeMotion
          ? 'inset 0 0 0 1px rgba(236, 228, 208, 0.12), inset 0 1px 0 rgba(236, 228, 208, 0.06), 0 18px 34px rgba(6, 8, 12, 0.24)'
          : undefined,
        transition: buildTransition(['transform', 'box-shadow'], 'l', 'resolve'),
      })}
    >
      <div style={{ ...createMetaLabelStyle(), marginBottom: 12 }}>יומן הפיצוח</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <LedgerColumn label="מתאים" entries={acceptedEntries} count={satisfies.length} result="accepted" />
        <LedgerColumn label="לא מתאים" entries={rejectedEntries} count={contradicts.length} result="rejected" />
      </div>
    </div>
  )
}

function LedgerColumn({
  count,
  entries,
  label,
  result,
}: {
  count: number
  entries: Array<EvidenceEntry | undefined>
  label: string
  result: 'accepted' | 'rejected'
}) {
  const tone = result === 'accepted' ? BRASS_TOKENS.soft : ACCENT_TOKENS.oxblood

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 8,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: tone,
          }}
        />
        <div style={{ ...createMetaLabelStyle(), letterSpacing: '0.12em' }}>{label}</div>
        <div
          style={{
            fontFamily: serifFontFamily,
            fontSize: 12,
            lineHeight: 1.1,
            color: alpha(TEXT_COLORS.secondary, 0.68),
            fontStyle: 'italic',
          }}
        >
          {count}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {entries.map((entry, index) => (
          <EvidenceChip key={`${label}-${index}-${entry?.catalog ?? 'empty'}`} entry={entry} result={result} />
        ))}
      </div>
    </div>
  )
}

export function RuleRegister({
  label = 'פיצוח החוק',
  lit,
  readyMotionKey,
  resolved,
  status,
  total = 6,
}: {
  label?: string
  lit: number
  readyMotionKey?: string
  resolved?: boolean
  status: string
  total?: number
}) {
  const activeReadyMotion = useTriggeredMotion(readyMotionKey, 840)
  return (
    <div
      style={createPanelStyle({
        transform: activeReadyMotion ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: activeReadyMotion
          ? `inset 0 0 0 1px ${alpha(BRASS_TOKENS.soft, 0.16)}, inset 0 1px 0 rgba(236, 228, 208, 0.08), 0 22px 36px rgba(6, 8, 12, 0.24)`
          : undefined,
        transition: buildTransition(['transform', 'box-shadow'], 'xl', 'resolve'),
      })}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <div style={createMetaLabelStyle()}>{label}</div>
        <div
          style={{
            fontFamily: serifFontFamily,
            fontSize: 13,
            lineHeight: 1.2,
            color: resolved ? alpha(BRASS_TOKENS.soft, 0.92) : alpha(TEXT_COLORS.secondary, 0.64),
            fontStyle: 'italic',
          }}
        >
          {status}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${total}, 1fr)`,
          gap: 10,
          alignItems: 'center',
        }}
      >
        {Array.from({ length: total }, (_, index) => {
          const isLit = index < lit
          const isMarked = index === Math.floor(total / 2)

          return (
            <span
              key={`${label}-${index}`}
              style={{
                position: 'relative',
                display: 'block',
                height: 10,
                borderRadius: 999,
                background: isLit
                  ? `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, resolved ? 0.78 : 0.68)} 0%, ${alpha(TEXT_COLORS.primary, 0.92)} 100%)`
                  : 'linear-gradient(90deg, rgba(236, 228, 208, 0.08) 0%, rgba(236, 228, 208, 0.14) 100%)',
                boxShadow: isLit ? `0 0 0 1px ${alpha(BRASS_TOKENS.soft, 0.10)}` : 'inset 0 0 0 1px rgba(236, 228, 208, 0.04)',
                transform: activeReadyMotion && isLit ? 'translateY(-1px)' : 'translateY(0)',
                transition: buildTransition(['background', 'box-shadow'], 'm', 'register', index * MOTION_STAGGER_MS.short),
              }}
            >
              {isMarked ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    transform: 'translate(-50%, -50%)',
                    background: isLit ? SURFACE_TOKENS.background : alpha(TEXT_COLORS.secondary, 0.42),
                  }}
                />
              ) : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function MicroActionRow({
  actions,
}: {
  actions: Array<{ disabled?: boolean; label: string; onClick?: () => void; strong?: boolean }>
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, rowGap: 10 }}>
      {actions.map((action, index) => (
        <React.Fragment key={action.label}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              style={{
                alignSelf: 'center',
                width: 3,
                height: 3,
                borderRadius: 999,
                background: alpha(BRASS_TOKENS.soft, 0.46),
              }}
            />
          ) : null}
          <button
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              padding: 0,
              margin: 0,
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              fontFamily: serifFontFamily,
              fontSize: 13,
              lineHeight: 1.2,
              letterSpacing: action.strong ? '0.08em' : '0.02em',
              textTransform: action.strong ? 'uppercase' : undefined,
              color: action.disabled
                ? alpha(TEXT_COLORS.secondary, 0.28)
                : action.strong
                  ? alpha(BRASS_TOKENS.soft, 0.92)
                  : alpha(TEXT_COLORS.secondary, 0.68),
              transition: buildTransition('color', 's', 'settle'),
            }}
          >
            {action.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

export function SpecimenPair({
  left,
  right,
}: {
  left: ArchiveCardSpec
  right: ArchiveCardSpec
}) {
  const entered = useEntranceMotion(40)

  return (
    <div
      style={{
        ...createPanelStyle({ padding: '18px 18px 16px' }),
        transform: entered ? 'translateY(0)' : 'translateY(12px)',
        opacity: entered ? 1 : 0,
        transition: buildTransition(['transform', 'opacity'], 'xl', 'resolve'),
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center' }}>
        <SpecimenTile label="מתאים" result="accepted" spec={left} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 24,
              background: `linear-gradient(180deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.78)} 100%)`,
            }}
          />
          <div style={{ ...createMetaLabelStyle(), letterSpacing: '0.14em' }}>מול</div>
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 24,
              background: `linear-gradient(180deg, ${alpha(BRASS_TOKENS.soft, 0.78)} 0%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
            }}
          />
        </div>
        <SpecimenTile label="לא מתאים" result="rejected" spec={right} />
      </div>
    </div>
  )
}

function SpecimenTile({
  label,
  result,
  spec,
}: {
  label: string
  result: 'accepted' | 'rejected'
  spec: ArchiveCardSpec
}) {
  const tone = result === 'accepted' ? BRASS_TOKENS.soft : ACCENT_TOKENS.oxblood

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: tone,
          }}
        />
        <div style={createMetaLabelStyle()}>{label}</div>
      </div>
      <ArchiveCard catalog={spec.catalog} glyph={spec.glyph} size="sm" state={result === 'accepted' ? 'accepted' : 'rejected'} />
      <div
        style={{
          minWidth: 116,
          padding: '8px 10px',
          borderRadius: 14,
          background: 'linear-gradient(180deg, rgba(17, 20, 27, 0.84) 0%, rgba(12, 14, 18, 0.92) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(236, 228, 208, 0.08)',
          textAlign: 'center',
          fontFamily: serifFontFamily,
          fontSize: 11,
          lineHeight: 1.2,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: alpha(TEXT_COLORS.secondary, 0.74),
        }}
      >
        {`HR / ${spec.catalog}`}
      </div>
    </div>
  )
}

export function EvidenceDigest({
  contradicts,
  satisfies,
}: {
  contradicts: number
  satisfies: number
}) {
  return (
    <div style={createPanelStyle({ padding: '14px 16px' })}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        <DigestColumn count={satisfies} label="מתאים" result="accepted" />
        <span
          aria-hidden="true"
          style={{
            width: 1,
            height: 34,
            background: `linear-gradient(180deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.88)} 50%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
          }}
        />
        <DigestColumn count={contradicts} label="לא מתאים" result="rejected" />
      </div>
    </div>
  )
}

function DigestColumn({
  count,
  label,
  result,
}: {
  count: number
  label: string
  result: 'accepted' | 'rejected'
}) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: result === 'accepted' ? BRASS_TOKENS.soft : ACCENT_TOKENS.oxblood,
          }}
        />
        <div style={createMetaLabelStyle()}>{label}</div>
      </div>
      <div
        style={{
          fontFamily: serifFontFamily,
          fontSize: 20,
          lineHeight: 1.05,
          color: TEXT_COLORS.primary,
          fontStyle: 'italic',
        }}
      >
        {count}
      </div>
    </div>
  )
}

export function RuleStatementSurface({
  footer,
  onChange,
  placeholder,
  preface,
  value,
}: {
  footer?: string
  onChange?: (value: string) => void
  placeholder: string
  preface: string
  value: string
}) {
  const [isFocused, setIsFocused] = React.useState(false)
  const entered = useEntranceMotion(120)

  return (
    <div
      style={{
        ...createPanelStyle({
          padding: '18px 18px 16px',
          background:
            'linear-gradient(180deg, rgba(236, 228, 211, 0.08) 0%, rgba(31, 37, 45, 0.94) 22%, rgba(18, 22, 29, 0.98) 100%)',
          transform: entered ? 'translateY(0)' : 'translateY(14px)',
          opacity: entered ? 1 : 0,
          transition: buildTransition(['transform', 'opacity'], 'xl', 'resolve'),
        }),
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 8,
          borderRadius: 16,
          border: `1px solid ${alpha(BRASS_TOKENS.soft, 0.12)}`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontFamily: serifFontFamily,
          fontSize: 14,
          lineHeight: 1.4,
          color: alpha(TEXT_COLORS.secondary, 0.72),
          fontStyle: 'italic',
          marginBottom: 12,
          textAlign: 'right',
        }}
      >
        {preface}
      </div>

      <div
        style={{
          position: 'relative',
          minHeight: 72,
          padding: '12px 0 20px',
          borderTop: '1px solid rgba(236, 228, 208, 0.06)',
          borderBottom: '1px solid rgba(236, 228, 208, 0.06)',
        }}
      >
        <input
          value={value}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={() => setIsFocused(true)}
          style={{
            width: '100%',
            border: 0,
            outline: 0,
            background: 'transparent',
            padding: 0,
            margin: 0,
            fontFamily: serifFontFamily,
            fontSize: 24,
            lineHeight: 1.35,
            fontStyle: 'italic',
            color: TEXT_COLORS.primary,
            caretColor: BRASS_TOKENS.soft,
            direction: 'rtl',
            textAlign: 'right',
          }}
        />

        {!value ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 14,
              fontFamily: serifFontFamily,
              fontSize: 22,
              lineHeight: 1.35,
              fontStyle: 'italic',
              color: alpha(TEXT_COLORS.secondary, 0.38),
              pointerEvents: 'none',
              direction: 'rtl',
              textAlign: 'right',
            }}
          >
            {placeholder}
          </span>
        ) : null}

        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 6,
            height: 1.5,
            borderRadius: 999,
            background: isFocused
              ? `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.94)} 24%, ${alpha(BRASS_TOKENS.soft, 0.94)} 76%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`
              : `linear-gradient(90deg, ${alpha(BRASS_TOKENS.soft, 0)} 0%, ${alpha(BRASS_TOKENS.soft, 0.42)} 24%, ${alpha(BRASS_TOKENS.soft, 0.42)} 76%, ${alpha(BRASS_TOKENS.soft, 0)} 100%)`,
            transition: buildTransition('background', 's', 'register'),
          }}
        />
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={createMetaLabelStyle()}>{footer ?? 'ניחוש / פתוח'}</div>
        <div
          style={{
            fontFamily: serifFontFamily,
            fontSize: 12,
            lineHeight: 1.1,
            color: alpha(TEXT_COLORS.secondary, 0.52),
            fontStyle: 'italic',
          }}
        >
          {`נותרו ${Math.max(0, 80 - value.length)} תווים`}
        </div>
      </div>
    </div>
  )
}

export function RuleChoiceSurface({
  footer,
  onSelect,
  options,
  selectedId,
}: {
  footer?: string
  onSelect?: (id: string) => void
  options: Array<{
    id: string
    label: string
    selected?: boolean
  }>
  selectedId?: string
}) {
  const entered = useEntranceMotion(120)

  return (
    <div
      style={{
        ...createPanelStyle({
          padding: '18px 18px 16px',
          background:
            'linear-gradient(180deg, rgba(236, 228, 211, 0.08) 0%, rgba(31, 37, 45, 0.94) 22%, rgba(18, 22, 29, 0.98) 100%)',
          transform: entered ? 'translateY(0)' : 'translateY(14px)',
          opacity: entered ? 1 : 0,
          transition: buildTransition(['transform', 'opacity'], 'xl', 'resolve'),
        }),
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 8,
          borderRadius: 16,
          border: `1px solid ${alpha(BRASS_TOKENS.soft, 0.12)}`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          fontFamily: serifFontFamily,
          fontSize: 14,
          lineHeight: 1.4,
          color: alpha(TEXT_COLORS.secondary, 0.72),
          fontStyle: 'italic',
          marginBottom: 12,
          textAlign: 'right',
        }}
      >
        בחר את החוק שנשמע נכון לפי הראיות שכבר נאספו.
      </div>

      <div
        style={{
          display: 'grid',
          gap: 10,
          borderTop: '1px solid rgba(236, 228, 208, 0.06)',
          borderBottom: '1px solid rgba(236, 228, 208, 0.06)',
          padding: '12px 0',
        }}
      >
        {options.map((option, index) => {
          const selected = option.selected || option.id === selectedId

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect?.(option.id)}
              aria-pressed={selected || undefined}
              style={{
                appearance: 'none',
                border: 0,
                background: selected
                  ? 'linear-gradient(180deg, rgba(61, 48, 26, 0.78) 0%, rgba(24, 28, 34, 0.96) 100%)'
                  : 'linear-gradient(180deg, rgba(24, 28, 34, 0.84) 0%, rgba(14, 17, 22, 0.96) 100%)',
                padding: '14px 16px',
                borderRadius: 16,
                boxShadow: selected
                  ? `inset 0 0 0 1px ${alpha(BRASS_TOKENS.soft, 0.28)}, 0 14px 24px rgba(6, 8, 12, 0.16)`
                  : 'inset 0 0 0 1px rgba(236, 228, 208, 0.08)',
                textAlign: 'right',
                cursor: 'pointer',
                transition: buildTransition(['background', 'box-shadow', 'transform'], 'm', 'settle'),
                transform: selected ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  alignItems: 'start',
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    marginTop: 1,
                    background: selected
                      ? alpha(BRASS_TOKENS.soft, 0.94)
                      : alpha(TEXT_COLORS.secondary, 0.24),
                    boxShadow: selected
                      ? `0 0 0 3px ${alpha(BRASS_TOKENS.soft, 0.14)}`
                      : `inset 0 0 0 1px ${alpha(TEXT_COLORS.secondary, 0.2)}`,
                    display: 'grid',
                    placeItems: 'center',
                    color: selected ? SURFACE_TOKENS.background : 'transparent',
                    fontFamily: serifFontFamily,
                    fontSize: 12,
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  {selected ? '•' : index + 1}
                </span>
                <div
                  style={{
                    fontFamily: serifFontFamily,
                    fontSize: 17,
                    lineHeight: 1.6,
                    color: selected
                      ? alpha(TEXT_COLORS.primary, 0.94)
                      : alpha(TEXT_COLORS.secondary, 0.82),
                    fontStyle: 'italic',
                  }}
                >
                  {option.label}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={createMetaLabelStyle()}>{footer ?? 'בחירה / פתוחה'}</div>
        <div
          style={{
            fontFamily: serifFontFamily,
            fontSize: 12,
            lineHeight: 1.1,
            color: alpha(TEXT_COLORS.secondary, 0.52),
            fontStyle: 'italic',
          }}
        >
          {selectedId ? 'אפשר לאשר את הבחירה' : 'בחר חוק אחד'}
        </div>
      </div>
    </div>
  )
}

