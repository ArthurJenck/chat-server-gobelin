export type StaffSettings = {
    spacing: number
    curvature: number
    thickness: number
}

export const DEFAULT_STAFF_SETTINGS: StaffSettings = {
    curvature: 0,
    spacing: 12,
    thickness: 2,
}

export const STAFF_SETTING_RANGES = {
    curvature: { min: 0, max: 30, step: 1 },
    spacing: { min: 6, max: 18, step: 1 },
    thickness: { min: 1, max: 4, step: 0.5 },
} as const

export const STAFF_GEOMETRY = {
    width: 320,
    height: 120,
    lineCount: 5,
    startX: 8,
    leftHandleX1: 65,
    leftHandleX2: 95,
    centerX: 160,
    rightHandleX1: 225,
    rightHandleX2: 255,
    endX: 312,
} as const

export const STAFF_ANIMATION = {
    duration: 0.4,
    ease: 'power2.out',
} as const
