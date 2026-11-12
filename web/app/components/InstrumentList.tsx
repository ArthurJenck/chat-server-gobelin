import { useEffect, useRef, useState } from "react";
import { playInstrumentPreview, randomPreviewNote } from "../features/sound/instrumentPreview";
import { INSTRUMENTS, type Instrument } from "../features/sound/soundConfig";
import "./InstrumentList.css";

const instrumentOrder: Instrument[] = [
    "guitar",
    "piano",
    "trumpet",
    "flute",
    "piccolo",
    "oboe",
    "bassoon",
    "horn",
    "clarinet",
    "violin",
    "contrabass",
    "cello",
    "sax",
    "trombone",
    "tuba",
    "accordion",
    "bagpipe",
    "ocarina",
    "xylophone",
    "pan_flute",
    "electric_guitar",
    "bass",
    "organ",
    "harpsichord",
    "harp",
    "harmonica",
    "banjo",
    "koto",
    "voice",
];

type InstrumentListProps = {
    selected: Instrument | null;
    onChange: (instrument: Instrument) => void;
    labelledBy: string;
};

export default function InstrumentList({
    selected,
    onChange,
    labelledBy,
}: InstrumentListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<AbortController | null>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    function updateOverflow() {
        const scrollArea = scrollRef.current;
        if (!scrollArea) return;
        setCanScrollUp(scrollArea.scrollTop > 1);
        setCanScrollDown(
            scrollArea.scrollTop + scrollArea.clientHeight <
                scrollArea.scrollHeight - 1,
        );
    }

    useEffect(() => {
        const scrollArea = scrollRef.current;
        if (!scrollArea) return;
        updateOverflow();
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(updateOverflow);
            observer.observe(scrollArea);
            return () => observer.disconnect();
        }
        window.addEventListener("resize", updateOverflow);
        return () => window.removeEventListener("resize", updateOverflow);
    }, []);

    useEffect(() => () => previewRef.current?.abort(), []);

    function preview(instrument: Instrument) {
        previewRef.current?.abort();
        const controller = new AbortController();
        previewRef.current = controller;
        void playInstrumentPreview(instrument, randomPreviewNote(instrument), controller.signal);
    }

    return (
        <div
            className={`instrument-list${canScrollUp ? " instrument-list--fade-top" : ""}${canScrollDown ? " instrument-list--fade-bottom" : ""}`}
        >
            <div
                ref={scrollRef}
                className="instrument-list-scroll"
                role="radiogroup"
                aria-labelledby={labelledBy}
                onScroll={updateOverflow}
            >
                <div className="instrument-list-grid">
                    {instrumentOrder.map((value) => (
                        <label
                            key={value}
                            className={`instrument-list-option${selected && selected !== value ? " instrument-list-option--dimmed" : ""}`}
                        >
                            <input
                                type="radio"
                                name="instrument"
                                value={value}
                                checked={selected === value}
                                onChange={() => onChange(value)}
                                onClick={() => preview(value)}
                            />
                            <span>
                                {value === "pan_flute"
                                    ? "Flûte de pan"
                                    : INSTRUMENTS[value].label}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
