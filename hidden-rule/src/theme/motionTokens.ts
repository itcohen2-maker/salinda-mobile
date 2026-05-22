export const MOTION_CURVES = {
  settle: 'cubic-bezier(0.20, 0.70, 0.30, 1.00)',
  lift: 'cubic-bezier(0.20, 0.00, 0.00, 1.00)',
  register: 'cubic-bezier(0.40, 0.00, 0.20, 1.00)',
  draw: 'cubic-bezier(0.40, 0.05, 0.20, 1.00)',
  resolve: 'cubic-bezier(0.25, 0.10, 0.25, 1.00)',
} as const

export const MOTION_DURATIONS_MS = {
  xs: 120,
  s: 200,
  m: 320,
  l: 480,
  xl: 720,
} as const

export const MOTION_STAGGER_MS = {
  short: 80,
  medium: 120,
} as const

export type MotionCurveId = keyof typeof MOTION_CURVES
export type MotionDurationId = keyof typeof MOTION_DURATIONS_MS

export function buildTransition(
  properties: string | readonly string[],
  durationId: MotionDurationId = 'm',
  curveId: MotionCurveId = 'settle',
  delayMs = 0,
) {
  const propertyList = Array.isArray(properties) ? properties : [properties]

  return propertyList
    .map(
      (property) =>
        `${property} ${MOTION_DURATIONS_MS[durationId]}ms ${MOTION_CURVES[curveId]} ${delayMs}ms`,
    )
    .join(', ')
}
