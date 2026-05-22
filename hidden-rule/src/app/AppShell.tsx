import * as React from 'react'

import {
  DEFAULT_BACKGROUND_PRESET_ID,
  type BackgroundPresetId,
  buildBackgroundRecipe,
  FONT_STACKS,
  type ScreenToneId,
  TEXT_COLORS,
} from '../theme'
import { createBackgroundStyle, scaleContentFrame } from './backgroundStyle'

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

type AppShellProps = {
  bottomBar?: React.ReactNode
  children: React.ReactNode
  eyebrow?: string
  presetId?: BackgroundPresetId
  screenToneId?: ScreenToneId
  subtitle?: string
  title?: string
  topBar?: React.ReactNode
}

export function AppShell({
  bottomBar,
  children,
  eyebrow,
  presetId = DEFAULT_BACKGROUND_PRESET_ID,
  screenToneId = 'gameplay',
  subtitle,
  title,
  topBar,
}: AppShellProps) {
  const recipe = React.useMemo(
    () => buildBackgroundRecipe(presetId, screenToneId),
    [presetId, screenToneId],
  )
  const background = createBackgroundStyle(recipe)
  const frameInsets = scaleContentFrame(recipe)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        background: '#101217',
        padding: 24,
        boxSizing: 'border-box',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          minHeight: 860,
          borderRadius: 42,
          background: 'linear-gradient(180deg, #1B1820 0%, #110F15 100%)',
          boxShadow: 'inset 0 0 0 1.5px #3A2D14, inset 0 0 0 3px #0A0709, 0 30px 60px -20px rgba(0, 0, 0, 0.7)',
          padding: 14,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            ...background,
            width: '100%',
            minHeight: '100%',
            borderRadius: 30,
            padding: '22px 20px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {topBar ? <div style={{ marginBottom: 18 }}>{topBar}</div> : null}

          {eyebrow || title || subtitle ? (
            <div
              style={{
                padding: `0 ${Math.max(0, frameInsets.right - 14)}px 10px ${Math.max(0, frameInsets.left - 14)}px`,
                textAlign: 'center',
              }}
            >
              {eyebrow ? (
                <div
                  style={{
                    fontFamily: serifFontFamily,
                    fontSize: 11,
                    lineHeight: 1.2,
                    letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                    color: 'rgba(214, 179, 108, 0.82)',
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  {eyebrow}
                </div>
              ) : null}

              {title ? (
                <div
                  style={{
                    fontFamily: serifFontFamily,
                    fontSize: 30,
                    lineHeight: 1.12,
                    fontWeight: 500,
                    fontStyle: 'italic',
                    color: TEXT_COLORS.primary,
                  }}
                >
                  {title}
                </div>
              ) : null}

              {subtitle ? (
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: serifFontFamily,
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    color: 'rgba(236, 228, 208, 0.64)',
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              padding: `6px ${Math.max(16, frameInsets.right - 10)}px ${Math.max(18, frameInsets.bottom - 24)}px ${Math.max(16, frameInsets.left - 10)}px`,
            }}
          >
            {children}
          </div>

          {bottomBar ? <div style={{ marginTop: 12 }}>{bottomBar}</div> : null}
        </div>
      </div>
    </div>
  )
}
