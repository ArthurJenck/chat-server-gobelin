import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export type StaffSettings = {
    spacing: number
    curvature: number
    thickness: number
}

function linePath(index: number, spacing: number, curvature: number) {
    const y = 60 + (index - 2) * spacing
    return `M 8 ${y} C 65 ${y - curvature} 95 ${y - curvature} 160 ${y} C 225 ${y + curvature} 255 ${y + curvature} 312 ${y}`
}

export default function MessageStaff({ user, settings }: { user: string, settings: StaffSettings }) {
    const paths = useRef<(SVGPathElement | null)[]>([])
    const current = useRef({ ...settings })

    useEffect(() => {
        const animation = gsap.to(current.current, {
            ...settings,
            duration: 0.4,
            ease: 'power2.out',
            onUpdate: () => {
                paths.current.forEach((path, index) => {
                    path?.setAttribute('d', linePath(index, current.current.spacing, current.current.curvature))
                    path?.setAttribute('stroke-width', String(current.current.thickness))
                })
            },
        })

        return () => { animation.kill() }
    }, [settings.spacing, settings.curvature, settings.thickness])

    return (
        <svg role="img" aria-label={`Portée de ${user}`} viewBox="0 0 320 120" width="320" height="120" style={{ display: 'block', maxWidth: '100%' }}>
            {Array.from({ length: 5 }, (_, index) => (
                <path
                    key={index}
                    ref={(path) => { paths.current[index] = path }}
                    d={linePath(index, current.current.spacing, current.current.curvature)}
                    fill="none"
                    stroke="black"
                    strokeWidth={current.current.thickness}
                />
            ))}
        </svg>
    )
}
