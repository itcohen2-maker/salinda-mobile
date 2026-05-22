import * as React from 'react'

import { ACCENT_TOKENS, FONT_STACKS, TEXT_COLORS } from '../../theme'
import type { InputFieldState } from './controlStates'
import type { IconGlyphId } from './iconButtonTokens'
import { IconGlyph } from './IconGlyph'

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

type HiddenRuleInputProps = {
  ariaLabel?: string
  block?: boolean
  hint?: string
  label: string
  lang?: string
  onChange?: (value: string) => void
  placeholder?: string
  prefixIcon?: IconGlyphId
  state?: InputFieldState
  suffix?: string
  value: string
}

export function HiddenRuleInput({
  ariaLabel,
  block,
  hint,
  label,
  lang,
  onChange,
  placeholder,
  prefixIcon = 'search',
  state = 'idle',
  suffix,
  value,
}: HiddenRuleInputProps) {
  const isFocused = state === 'focused'
  const isFilled = state === 'filled' || value.trim().length > 0
  const isInvalid = state === 'invalid'
  const isDisabled = state === 'disabled'

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: block ? '100%' : undefined,
    minWidth: block ? 0 : 240,
    maxWidth: block ? '100%' : 360,
  }

  const chromeStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: 14,
    padding: '11px 14px 12px',
    background: isDisabled
      ? 'linear-gradient(180deg, #1A1C22 0%, #14161B 100%)'
      : 'radial-gradient(120% 95% at 50% 24%, rgba(36, 56, 96, 0.15) 0%, transparent 74%), linear-gradient(180deg, #232730 0%, #161A21 100%)',
    boxShadow: isFocused
      ? `inset 0 0 0 1px rgba(201, 165, 96, 0.55), inset 0 1px 0 rgba(236, 228, 208, 0.08), 0 0 0 2px #0C0E14, 0 0 0 3.5px ${ACCENT_TOKENS.oxblood}, 0 0 0 4.5px rgba(140, 52, 56, 0.25)`
      : isInvalid
        ? 'inset 0 0 0 1px rgba(140, 52, 56, 0.42), inset 0 1px 0 rgba(236, 228, 208, 0.05), 0 1px 2px rgba(0, 0, 0, 0.36)'
        : isDisabled
          ? 'inset 0 0 0 1px rgba(236, 228, 208, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.25)'
          : 'inset 0 0 0 1px rgba(236, 228, 208, 0.20), inset 0 1px 0 rgba(236, 228, 208, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.36)',
  }

  const eyebrowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: 12,
    fontFamily: serifFontFamily,
    fontSize: 10,
    lineHeight: 1.15,
    letterSpacing: lang === 'he' ? '0.04em' : '0.18em',
    textTransform: lang === 'he' ? undefined : 'uppercase',
    color: isDisabled ? 'rgba(236, 228, 208, 0.26)' : isFilled ? 'rgba(214, 179, 108, 0.94)' : 'rgba(214, 179, 108, 0.82)',
    fontWeight: 500,
  }

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 32,
    paddingTop: 8,
    borderTop: '1px solid rgba(236, 228, 208, 0.06)',
  }

  const iconSlotStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    color: isDisabled ? 'rgba(236, 228, 208, 0.26)' : 'rgba(168, 138, 88, 0.92)',
  }

  const iconStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  const inputStyle: React.CSSProperties = {
    appearance: 'none',
    border: 0,
    outline: 'none',
    background: 'transparent',
    color: isDisabled ? 'rgba(236, 228, 208, 0.28)' : TEXT_COLORS.primary,
    width: '100%',
    minWidth: 0,
    padding: 0,
    margin: 0,
    fontFamily: serifFontFamily,
    fontSize: 17,
    lineHeight: 1.3,
    letterSpacing: 0,
  }

  const suffixStyle: React.CSSProperties = {
    color: isDisabled ? 'rgba(236, 228, 208, 0.26)' : 'rgba(207, 198, 184, 0.54)',
    fontFamily: serifFontFamily,
    fontSize: 12,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  }

  const hintStyle: React.CSSProperties = {
    padding: '0 4px',
    fontFamily: serifFontFamily,
    fontSize: 12,
    lineHeight: 1.45,
    color: isDisabled ? 'rgba(236, 228, 208, 0.26)' : isInvalid ? 'rgba(207, 130, 130, 0.78)' : 'rgba(236, 228, 208, 0.58)',
    fontStyle: 'italic',
  }

  const invalidRuleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 8,
    height: 1.5,
    borderRadius: 1,
    background: 'linear-gradient(90deg, rgba(140, 52, 56, 0) 0%, rgba(140, 52, 56, 0.9) 18%, rgba(168, 138, 88, 0.42) 50%, rgba(140, 52, 56, 0.9) 82%, rgba(140, 52, 56, 0) 100%)',
    pointerEvents: 'none',
  }

  return (
    <div style={rootStyle} lang={lang} dir="auto">
      <div style={chromeStyle}>
        <div style={eyebrowStyle}>{label}</div>
        <div style={fieldRowStyle}>
          <span aria-hidden="true" style={iconSlotStyle}>
            <span style={iconStyle as React.CSSProperties}>
              <IconGlyph icon={prefixIcon} />
            </span>
          </span>
          <input
            aria-label={ariaLabel ?? label}
            aria-invalid={isInvalid || undefined}
            className="hidden-rule-input"
            disabled={isDisabled}
            dir="auto"
            lang={lang}
            placeholder={placeholder}
            readOnly={!onChange}
            style={inputStyle}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
          />
          {suffix ? <span style={suffixStyle}>{suffix}</span> : null}
        </div>
        {isInvalid ? <span aria-hidden="true" style={invalidRuleStyle} /> : null}
      </div>
      {hint ? <div style={hintStyle}>{hint}</div> : null}
    </div>
  )
}
