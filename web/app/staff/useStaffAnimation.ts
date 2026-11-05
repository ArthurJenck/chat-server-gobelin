import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { STAFF_ANIMATION, type StaffSettings } from './staffConfig'
import { getStaffLinePath } from './staffGeometry'

export function useStaffAnimation(settings: StaffSettings) {
    const paths = useRef<(SVGPathElement | null)[]>([])
    const currentSettings = useRef({ ...settings })

    useEffect(() => {
        const animation = gsap.to(currentSettings.current, {
            ...settings,
            ...STAFF_ANIMATION,
            onUpdate: () => {
                paths.current.forEach((path, index) => {
                    path?.setAttribute('d', getStaffLinePath(index, currentSettings.current))
                    path?.setAttribute('stroke-width', String(currentSettings.current.thickness))
                })
            },
        })

        return () => { animation.kill() }
    }, [settings.spacing, settings.curvature, settings.thickness])

    return { paths, currentSettings }
}
