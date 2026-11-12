import type { ChannelStaffBlock } from "./channelPagination";
import { CHANNEL_SOUND_SETTINGS } from "./channelPagination";
import { messageInstrument } from "./messageSound";
import { withInstrumentProfile, type SoundSettings } from "../sound/soundConfig";
import type { SoundPlan } from "../sound/soundPlan";
import type { Message } from "../messages/types";

export function messageIdentity(message: Message) {
    return String(message.id ?? `${message.creation_date}-${message.user_id}-${message.content}`);
}

export type ChannelPerformance = {
    id: string;
    blockKeys: string[];
    plan: SoundPlan;
    settings: SoundSettings;
    eventStarts: Record<number, number>;
    maxNoteDuration?: number;
    manual?: boolean;
};

export function pagePerformances(page: ChannelStaffBlock[]): ChannelPerformance[] {
    const groups: ChannelStaffBlock[][] = [];
    for (const block of page) {
        const last = groups.at(-1);
        if (last && messageIdentity(last[0].message) === messageIdentity(block.message))
            last.push(block);
        else groups.push([block]);
    }
    return groups.map((blocks) => {
        const first = blocks[0];
        const indexes = [...new Set(blocks.flatMap((block) => block.row.map((group) => group.eventIndex)))].sort((a, b) => a - b);
        const offset = first.plan.events[indexes[0]]?.start ?? 0;
        const events = indexes.map((index) => ({
            ...first.plan.events[index],
            start: first.plan.events[index].start - offset,
        }));
        return {
            id: messageIdentity(first.message),
            blockKeys: blocks.map((block) => block.key),
            plan: { ...first.plan, events },
            settings: withInstrumentProfile(
                { ...CHANNEL_SOUND_SETTINGS, ...first.pageKey, mode: first.mode },
                messageInstrument(first.message),
            ),
            eventStarts: Object.fromEntries(indexes.map((index, position) => [index, events[position].start])),
        };
    });
}

export function messagePerformance(block: ChannelStaffBlock, page: ChannelStaffBlock[]): ChannelPerformance {
    const performance = pagePerformances(page.filter((item) =>
        messageIdentity(item.message) === messageIdentity(block.message)))[0];
    return {
        ...performance,
        blockKeys: [block.key, ...performance.blockKeys.filter((key) => key !== block.key)],
        plan: block.plan,
        eventStarts: Object.fromEntries(block.plan.events.map((event, index) => [index, event.start])),
        manual: true,
    };
}

export function glissandoPerformance(direction: "older" | "newer"): ChannelPerformance {
    const pitches = Array.from({ length: 25 }, (_, index) =>
        direction === "older" ? 84 - index : 60 + index,
    );
    return {
        id: `glissando-${direction}`,
        blockKeys: [],
        plan: {
            events: pitches.map((midi, index) => ({
                text: "", wordId: null, midi, start: index * 0.02,
            })),
            tonicMidi: 60,
            density: 50,
            noteStep: 0.02,
        },
        settings: {
            ...CHANNEL_SOUND_SETTINGS,
            instrument: "piano",
            chordPlacement: "off",
            thirdPlacement: "off",
            gate: 0.7,
        },
        eventStarts: {},
        maxNoteDuration: 0.04,
    };
}
