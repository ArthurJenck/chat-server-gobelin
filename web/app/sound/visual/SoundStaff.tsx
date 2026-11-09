import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { SoundSettings } from '../soundConfig'
import type { SoundPlan } from '../soundPlan'
import { DEFAULT_STAFF_WIDTH, layoutSoundStaff } from './staffLayout'

export default function SoundStaff({
    plan,
    settings,
    getPlayhead,
}: {
    plan: SoundPlan | null
    settings: SoundSettings
    getPlayhead: (() => number | null) | null
}) {
    const container = useRef<HTMLDivElement>(null)
    const nodes = useRef<(HTMLSpanElement | null)[]>([])
    const [width, setWidth] = useState(DEFAULT_STAFF_WIDTH)
    const layout = layoutSoundStaff(plan, settings, width)

    useEffect(() => {
        const update = () =>
            setWidth(container.current?.clientWidth || DEFAULT_STAFF_WIDTH)
        update()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(update)
        observer.observe(container.current!)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!plan || !getPlayhead) return
        const timeline = gsap.timeline({ paused: true })
        layout.groups.forEach((group) => {
            const node = nodes.current[group.eventIndex]
            if (!node) return
            timeline.fromTo(
                node,
                { y: -settings.visualRise, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: settings.visualDuration,
                    ease: settings.visualEase,
                },
                plan.events[group.eventIndex].start
            )
        })
        let frame = 0
        const update = () => {
            const playhead = getPlayhead()
            if (playhead === null) return
            const visualTime = Math.max(0, playhead - settings.visualDelayMs / 1000)
            timeline.time(visualTime)
            if (visualTime < timeline.duration())
                frame = requestAnimationFrame(update)
        }
        update()
        return () => {
            cancelAnimationFrame(frame)
            timeline.kill()
        }
    }, [plan, settings, getPlayhead, width])

    return (
        <div
            ref={container}
            role="img"
            aria-label="Portée de l’atelier son"
            style={{ width: '100%' }}
        >
            {layout.rows.map((row, index) => (
                <div key={index} style={{ position: 'relative' }}>
                    <svg
                        aria-hidden="true"
                        viewBox={`0 0 ${layout.width} ${layout.height}`}
                        width="100%"
                        height={layout.height}
                        overflow="visible"
                        style={{ display: 'block', marginBottom: '2.5rem' }}
                    >
                        {layout.lines.map((y, line) => (
                            <line
                                key={line}
                                x1={0}
                                x2={layout.width}
                                y1={y}
                                y2={y}
                                stroke="currentColor"
                                strokeWidth={settings.visualLineThickness}
                            />
                        ))}
                    </svg>
                    {row.map((group) => (
                        <span
                            key={group.eventIndex}
                            ref={(node) => {
                                nodes.current[group.eventIndex] = node
                            }}
                            style={{
                                position: 'absolute',
                                left: group.x,
                                top: group.y,
                                translate: '0 -50%',
                                fontSize: settings.visualFontSize,
                                whiteSpace: 'pre',
                                opacity: 0,
                            }}
                        >
                            {group.text}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    )
}
