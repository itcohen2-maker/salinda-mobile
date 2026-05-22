import * as React from 'react'

import { ACCENT_TOKENS, BRASS_TOKENS, FONT_STACKS } from '../../theme'
import type { InteractiveState, SelectableState } from '../ui'
import { IconGlyph } from '../ui/IconGlyph'
import { ICON_BUTTON_SIZES, type IconButtonSize, type IconGlyphId } from '../ui'

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

const sharedLabelStyle: React.CSSProperties = {
  fontFamily: serifFontFamily,
  fontWeight: 500,
  lineHeight: 1.22,
  letterSpacing: '0.005em',
  textAlign: 'center',
  minWidth: 0,
  maxWidth: '100%',
  wordBreak: 'break-word',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
}

type ActionButtonProps = {
  block?: boolean
  label: string
  lang?: string
  onClick?: () => void
  state?: InteractiveState
}

type IconButtonProps = {
  icon: IconGlyphId
  label: string
  onClick?: () => void
  size?: IconButtonSize
  state?: SelectableState
}

function focusRingStyle(enabled: boolean): React.CSSProperties | undefined {
  if (!enabled) {
    return undefined
  }

  return {
    boxShadow: `0 0 0 2px #0C0E14, 0 0 0 4px ${ACCENT_TOKENS.oxblood}, 0 0 0 5.5px rgba(140, 52, 56, 0.28)`,
  }
}

export function PrimaryButton({
  block,
  label,
  lang,
  onClick,
  state = 'idle',
}: ActionButtonProps) {
  const isPressed = state === 'pressed'
  const isFocused = state === 'focused'
  const isDisabled = state === 'disabled'

  const buttonStyle: React.CSSProperties = {
    appearance: 'none',
    border: 0,
    margin: 0,
    padding: '1.25px',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    userSelect: 'none',
    font: 'inherit',
    boxSizing: 'border-box',
    display: block ? 'flex' : 'inline-flex',
    alignItems: 'stretch',
    width: block ? '100%' : undefined,
    minWidth: block ? 0 : 200,
    maxWidth: block ? '100%' : 340,
    minHeight: 56,
    borderRadius: 14,
    background: isDisabled
      ? 'linear-gradient(180deg, #6B6358 0%, #4F4940 50%, #383229 100%)'
      : isPressed
        ? 'linear-gradient(180deg, #A07F3B 0%, #7A5D26 40%, #5A4218 100%)'
        : 'linear-gradient(180deg, #D6B36C 0%, #B89149 22%, #8C6B2C 58%, #5A4218 100%)',
    filter: isPressed
      ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.45)) drop-shadow(0 1px 2px rgba(6,8,12,0.35)) drop-shadow(0 2px 4px rgba(6,8,12,0.22))'
      : isDisabled
        ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.22))'
        : 'drop-shadow(0 1px 0 rgba(0,0,0,0.50)) drop-shadow(0 2px 3px rgba(6,8,12,0.40)) drop-shadow(0 8px 16px rgba(6,8,12,0.30))',
    transform: isPressed ? 'translateY(1.5px)' : undefined,
    ...focusRingStyle(isFocused && !isDisabled),
  }

  const faceStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 28px',
    borderRadius: 12.5,
    background: isDisabled
      ? 'linear-gradient(180deg, #2A2C32 0%, #1C1E24 100%)'
      : isPressed
        ? 'radial-gradient(120% 90% at 50% 60%, rgba(20, 32, 58, 0.30) 0%, transparent 75%), linear-gradient(180deg, #0F1118 0%, #1A1D27 100%)'
        : 'radial-gradient(120% 90% at 50% 38%, rgba(36, 56, 96, 0.24) 0%, rgba(36, 56, 96, 0.08) 35%, transparent 75%), linear-gradient(180deg, #262934 0%, #14161E 100%)',
    boxShadow: isDisabled
      ? 'inset 0 1px 0 rgba(236, 228, 208, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.35), inset 0 0 10px rgba(0, 0, 0, 0.22)'
      : isPressed
        ? 'inset 0 2px 3px rgba(0, 0, 0, 0.7), inset 0 8px 10px -6px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(236, 228, 208, 0.04)'
        : 'inset 0 1px 0 rgba(236, 228, 208, 0.10), inset 0 2px 1px rgba(236, 228, 208, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.55), inset 0 -10px 14px -8px rgba(0, 0, 0, 0.50), inset 0 0 18px rgba(0, 0, 0, 0.28)',
  }

  const labelStyle: React.CSSProperties = {
    ...sharedLabelStyle,
    fontSize: 19,
    color: isDisabled ? 'rgba(236, 228, 208, 0.30)' : '#ECE4D0',
    textShadow: isDisabled ? '0 1px 0 rgba(0, 0, 0, 0.4)' : '0 1px 0 rgba(0, 0, 0, 0.6)',
  }

  return (
    <button type="button" disabled={isDisabled} onClick={onClick} lang={lang} dir="auto" aria-label={label} style={buttonStyle}>
      <span style={faceStyle}>
        <span style={labelStyle}>{label}</span>
      </span>
    </button>
  )
}

export function SecondaryButton({
  block,
  label,
  lang,
  onClick,
  state = 'idle',
}: {
  block?: boolean
  label: string
  lang?: string
  onClick?: () => void
  state?: SelectableState
}) {
  const isPressed = state === 'pressed'
  const isFocused = state === 'focused'
  const isSelected = state === 'selected'
  const isDisabled = state === 'disabled'

  const buttonStyle: React.CSSProperties = {
    appearance: 'none',
    border: 0,
    margin: 0,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    font: 'inherit',
    boxSizing: 'border-box',
    position: 'relative',
    display: block ? 'flex' : 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: block ? '100%' : undefined,
    minWidth: block ? 0 : 120,
    maxWidth: block ? '100%' : 280,
    minHeight: 48,
    padding: '10px 22px',
    borderRadius: 11,
    background: isDisabled
      ? 'linear-gradient(180deg, #1A1C22 0%, #14161B 100%)'
      : isSelected
        ? 'linear-gradient(180deg, #1F2A42 0%, #131A2A 100%)'
        : isPressed
          ? 'linear-gradient(180deg, #0E1018 0%, #181B23 100%)'
          : 'linear-gradient(180deg, #232631 0%, #15171F 100%)',
    boxShadow: isDisabled
      ? 'inset 0 0 0 1px rgba(236, 228, 208, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.25)'
      : isSelected
        ? 'inset 0 0 0 1px rgba(201, 165, 96, 0.55), inset 0 1px 0 rgba(236, 228, 208, 0.10), 0 1px 2px rgba(0, 0, 0, 0.50)'
        : isPressed
          ? 'inset 0 0 0 1px rgba(236, 228, 208, 0.22), inset 0 2px 3px rgba(0, 0, 0, 0.7), inset 0 8px 10px -8px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(236, 228, 208, 0.04)'
          : 'inset 0 0 0 1px rgba(236, 228, 208, 0.22), inset 0 1px 0 rgba(236, 228, 208, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.40)',
    ...focusRingStyle(isFocused && !isDisabled),
  }

  const labelStyle: React.CSSProperties = {
    ...sharedLabelStyle,
    fontSize: 16,
    color: isDisabled ? 'rgba(236, 228, 208, 0.28)' : '#ECE4D0',
    textShadow: isDisabled ? 'none' : isSelected ? '0 1px 0 rgba(0, 0, 0, 0.6), 0 0 10px rgba(40, 60, 100, 0.40)' : '0 1px 0 rgba(0, 0, 0, 0.55)',
    transform: isPressed ? 'translateY(0.5px)' : undefined,
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      lang={lang}
      dir="auto"
      aria-label={label}
      aria-pressed={isSelected || undefined}
      style={buttonStyle}
    >
      <span style={labelStyle}>{label}</span>
      {isSelected ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '18%',
            right: '18%',
            bottom: 4,
            height: 1.5,
            pointerEvents: 'none',
            background: 'linear-gradient(90deg, rgba(201, 165, 96, 0) 0%, rgba(201, 165, 96, 0.90) 22%, rgba(214, 179, 108, 0.95) 50%, rgba(201, 165, 96, 0.90) 78%, rgba(201, 165, 96, 0) 100%)',
            borderRadius: 1,
          }}
        />
      ) : null}
    </button>
  )
}

export function PremiumButton({
  block,
  label,
  lang,
  onClick,
  state = 'idle',
}: ActionButtonProps) {
  const isPressed = state === 'pressed'
  const isFocused = state === 'focused'
  const isDisabled = state === 'disabled'

  const buttonStyle: React.CSSProperties = {
    appearance: 'none',
    border: 0,
    margin: 0,
    padding: '1.5px',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    userSelect: 'none',
    font: 'inherit',
    boxSizing: 'border-box',
    position: 'relative',
    display: block ? 'flex' : 'inline-flex',
    alignItems: 'stretch',
    width: block ? '100%' : undefined,
    minWidth: block ? 0 : 240,
    maxWidth: block ? '100%' : 360,
    minHeight: 64,
    borderRadius: 15,
    background: isDisabled
      ? 'linear-gradient(180deg, #6B6358 0%, #4F4940 50%, #383229 100%)'
      : isPressed
        ? 'linear-gradient(180deg, #A07F3B 0%, #7A5D26 40%, #5A4218 100%)'
        : 'linear-gradient(180deg, #DDBA72 0%, #BE9648 22%, #9A7732 58%, #5A4218 100%)',
    filter: isPressed
      ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.5)) drop-shadow(0 1px 2px rgba(20, 30, 56, 0.55)) drop-shadow(0 3px 6px rgba(8, 12, 22, 0.28))'
      : isDisabled
        ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.28))'
        : 'drop-shadow(0 1px 0 rgba(0,0,0,0.55)) drop-shadow(0 2px 3px rgba(20, 30, 56, 0.55)) drop-shadow(0 14px 24px rgba(8, 12, 22, 0.42))',
    transform: isPressed ? 'translateY(1.5px)' : undefined,
    ...focusRingStyle(isFocused && !isDisabled),
  }

  const faceStyle: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 36px',
    borderRadius: 13.5,
    background: isDisabled
      ? 'linear-gradient(180deg, #2A2C32 0%, #1C1E24 100%)'
      : isPressed
        ? 'radial-gradient(120% 90% at 50% 60%, rgba(20, 32, 58, 0.30) 0%, transparent 75%), linear-gradient(180deg, #0F1118 0%, #1A1D27 100%)'
        : 'radial-gradient(120% 90% at 50% 35%, rgba(36, 56, 96, 0.30) 0%, transparent 75%), linear-gradient(180deg, #272B37 0%, #11141C 100%)',
    boxShadow: isDisabled
      ? 'inset 0 1px 0 rgba(236, 228, 208, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.35), inset 0 0 12px rgba(0, 0, 0, 0.25)'
      : isPressed
        ? 'inset 0 2px 3px rgba(0, 0, 0, 0.75), inset 0 10px 12px -6px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(236, 228, 208, 0.04)'
        : 'inset 0 1px 0 rgba(236, 228, 208, 0.12), inset 0 2px 1px rgba(236, 228, 208, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.65), inset 0 -12px 16px -8px rgba(0, 0, 0, 0.55), inset 0 0 22px rgba(0, 0, 0, 0.32)',
  }

  const innerFrameStyle: React.CSSProperties = {
    position: 'absolute',
    inset: '5px 10px',
    borderRadius: 9,
    border: `0.75px solid ${isDisabled ? 'rgba(236, 228, 208, 0.08)' : 'rgba(214, 179, 108, 0.28)'}`,
    pointerEvents: 'none',
  }

  const edgeMarkerStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    height: 5,
    pointerEvents: 'none',
    background: isDisabled
      ? 'radial-gradient(circle at 5px 50%, #8A8275 0%, #4A4438 40%, transparent 65%), radial-gradient(circle at calc(100% - 5px) 50%, #8A8275 0%, #4A4438 40%, transparent 65%)'
      : 'radial-gradient(circle at 5px 50%, #E7C57A 0%, #8C6B2C 40%, rgba(140,107,44,0) 65%), radial-gradient(circle at calc(100% - 5px) 50%, #E7C57A 0%, #8C6B2C 40%, rgba(140,107,44,0) 65%)',
  }

  const labelStyle: React.CSSProperties = {
    ...sharedLabelStyle,
    position: 'relative',
    fontSize: 20,
    color: isDisabled ? 'rgba(236, 228, 208, 0.30)' : '#ECE4D0',
    textShadow: isDisabled ? '0 1px 0 rgba(0, 0, 0, 0.4)' : '0 1px 0 rgba(0, 0, 0, 0.7), 0 0 18px rgba(36, 56, 96, 0.40)',
  }

  return (
    <button type="button" disabled={isDisabled} onClick={onClick} lang={lang} dir="auto" aria-label={label} style={buttonStyle}>
      <span style={faceStyle}>
        <span aria-hidden="true" style={innerFrameStyle} />
        <span aria-hidden="true" style={edgeMarkerStyle} />
        <span style={labelStyle}>{label}</span>
      </span>
    </button>
  )
}

export function IconButton({
  icon,
  label,
  onClick,
  size = 'default',
  state = 'idle',
}: IconButtonProps) {
  const dimensions = ICON_BUTTON_SIZES[size]
  const isPressed = state === 'pressed'
  const isFocused = state === 'focused'
  const isSelected = state === 'selected'
  const isDisabled = state === 'disabled'

  const buttonStyle: React.CSSProperties = {
    appearance: 'none',
    border: 0,
    margin: 0,
    padding: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    userSelect: 'none',
    font: 'inherit',
    boxSizing: 'border-box',
    width: dimensions.box,
    height: dimensions.box,
    borderRadius: dimensions.radius,
    background: 'linear-gradient(180deg, rgba(236, 228, 208, 0.10) 0%, rgba(0, 0, 0, 0.18) 100%)',
    filter: isDisabled ? 'drop-shadow(0 1px 0 rgba(0, 0, 0, 0.22))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.38))',
    transform: isPressed ? 'translateY(1px)' : undefined,
    ...focusRingStyle(isFocused && !isDisabled),
  }

  const faceStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: dimensions.radius - 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isDisabled
      ? 'linear-gradient(180deg, #1A1C22 0%, #14161B 100%)'
      : isSelected
        ? 'radial-gradient(100% 90% at 50% 34%, rgba(46, 72, 118, 0.24) 0%, transparent 78%), linear-gradient(180deg, #1F2A42 0%, #131A2A 100%)'
        : isPressed
          ? 'radial-gradient(100% 90% at 50% 58%, rgba(20, 32, 58, 0.22) 0%, transparent 78%), linear-gradient(180deg, #0E1018 0%, #181B23 100%)'
          : 'radial-gradient(100% 90% at 50% 34%, rgba(36, 56, 96, 0.18) 0%, transparent 78%), linear-gradient(180deg, #232631 0%, #15171F 100%)',
    boxShadow: isDisabled
      ? 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.28)'
      : isSelected
        ? 'inset 0 0 0 1px rgba(201, 165, 96, 0.56), inset 0 1px 0 rgba(236, 228, 208, 0.10), inset 0 -1px 0 rgba(0, 0, 0, 0.58), 0 1px 2px rgba(0, 0, 0, 0.42)'
        : isPressed
          ? 'inset 0 0 0 1px rgba(236, 228, 208, 0.22), inset 0 2px 3px rgba(0, 0, 0, 0.68), inset 0 8px 10px -8px rgba(0, 0, 0, 0.48)'
          : 'inset 0 0 0 1px rgba(236, 228, 208, 0.22), inset 0 1px 0 rgba(236, 228, 208, 0.07), inset 0 -1px 0 rgba(0, 0, 0, 0.55), inset 0 0 14px rgba(0, 0, 0, 0.18)',
  }

  const glyphStyle: React.CSSProperties = {
    width: dimensions.glyph,
    height: dimensions.glyph,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isDisabled ? 'rgba(236, 228, 208, 0.24)' : isSelected ? '#D6B36C' : BRASS_TOKENS.soft,
    textShadow: isDisabled ? 'none' : '0 1px 0 rgba(0, 0, 0, 0.45)',
  }

  const iconStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  return (
    <button type="button" disabled={isDisabled} onClick={onClick} aria-label={label} aria-pressed={isSelected || undefined} style={buttonStyle}>
      <span style={faceStyle}>
        <span style={glyphStyle}>
          <span style={iconStyle as React.CSSProperties}>
            <IconGlyph icon={icon} />
          </span>
        </span>
      </span>
    </button>
  )
}
