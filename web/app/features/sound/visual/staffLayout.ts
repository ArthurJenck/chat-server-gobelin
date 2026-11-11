import type { SoundSettings } from "../soundConfig";
import { getScaleDegree, isWordBoundary, type SoundPlan } from "../soundPlan";

const LINE_COUNT = 5;
export const DEFAULT_STAFF_WIDTH = 320;
const GLYPH_WIDTH = 0.6;

export function layoutSoundStaff(
    plan: SoundPlan | null,
    settings: SoundSettings,
    width = DEFAULT_STAFF_WIDTH,
) {
    const radius = ((LINE_COUNT - 1) / 2) * settings.visualLineSpacing;
    const lines = Array.from(
        { length: LINE_COUNT },
        (_, index) => index * settings.visualLineSpacing,
    );
    const rows: {
        text: string;
        eventIndex: number;
        x: number;
        y: number;
        width: number;
        rest?: "quarter" | "half" | "whole";
    }[][] = [[]];
    plan?.events.forEach((event, index) => {
        let row = rows.at(-1)!;
        const previous = row.at(-1);
        let x = previous
            ? previous.x +
              previous.width +
              settings.visualSpacing +
              (isWordBoundary(plan.events[previous.eventIndex], event)
                  ? settings.visualWordSpacing
                  : 0)
            : 0;
        const groupWidth = event.rest
            ? event.rest === "quarter" ? 10 : 15
            : [...event.text].length * settings.visualFontSize * GLYPH_WIDTH;
        if (row.length && x + groupWidth > width) {
            row = [];
            rows.push(row);
            x = 0;
        }
        row.push({
            text: event.text,
            eventIndex: index,
            x,
            y: event.rest === "half"
                ? lines[2] - 2.5
                : event.rest === "whole"
                  ? lines[1] + 2.5
                  : event.rest === "quarter"
                    ? radius
                    : radius -
                      (getScaleDegree(
                          event.midi ?? plan.tonicMidi,
                          plan.tonicMidi,
                          settings.mode,
                      ) * settings.visualLineSpacing) / 2,
            width: groupWidth,
            rest: event.rest,
        });
    });
    return { lines, rows, groups: rows.flat(), width, height: lines.at(-1)! };
}
