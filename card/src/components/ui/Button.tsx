import React from 'react'
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'gold'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: Variant
  size?: Size
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

const bgColors: Record<Variant, string> = {
  primary: '#F59E0B',
  secondary: '#4B5563',
  danger: '#DC2626',
  success: '#16A34A',
  gold: '#F59E0B',
}

const textColors: Record<Variant, string> = {
  primary: '#111827',
  secondary: '#FFF',
  danger: '#FFF',
  success: '#FFF',
  gold: '#111827',
}

const paddings: Record<Size, [number, number]> = {
  sm: [6, 12],
  md: [10, 16],
  lg: [14, 24],
}

const fontSizes: Record<Size, number> = {
  sm: 13,
  md: 15,
  lg: 17,
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  onPress,
  disabled,
  style,
  testID,
}: ButtonProps) {
  const responsive = useResponsiveLayout()
  const [pv, ph] = paddings[size]
  const compactPaddingHorizontal = responsive.isTight ? Math.max(10, ph - 2) : ph
  const compactPaddingVertical = responsive.isTight ? Math.max(8, pv - 1) : pv
  const allowTwoLines = responsive.isSingleColumn
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      touchSoundDisabled
      style={[
        styles.base,
        {
          backgroundColor: bgColors[variant],
          paddingVertical: compactPaddingVertical,
          paddingHorizontal: compactPaddingHorizontal,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          numberOfLines={allowTwoLines ? 2 : 1}
          ellipsizeMode="tail"
          style={[styles.text, { color: textColors[variant], fontSize: fontSizes[size] }]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    minHeight: 44,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '100%',
    flexShrink: 1,
  },
})
