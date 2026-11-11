import type { Message } from "../messages/types";
import { withInstrumentProfile, DEFAULT_SOUND_SETTINGS } from "../sound/soundConfig";
import { createSoundPlan, type SoundPlan } from "../sound/soundPlan";
import { layoutSoundStaff } from "../sound/visual/staffLayout";
import { messageInstrument } from "./messageSound";

export const CHANNEL_STAFF_WIDTH = 360;
export const CHANNEL_STAFF_HEIGHT = 40;
export const CHANNEL_AUTHOR_HEIGHT = 20;
export const CHANNEL_STAFF_GAP = 20;

export const CHANNEL_SOUND_SETTINGS = {
    ...DEFAULT_SOUND_SETTINGS,
    mode: "major" as const,
    root: 0,
    visualLineSpacing: 10,
    visualLineThickness: 0.3,
    visualFontSize: 16,
};

export type ChannelStaffBlock = {
    key: string;
    message: Message;
    plan: SoundPlan;
    row: ReturnType<typeof layoutSoundStaff>["rows"][number];
    first: boolean;
};

function displayPlan(message: Message, plan: SoundPlan): SoundPlan {
    const words = [...new Intl.Segmenter("fr", { granularity: "word" }).segment(message.content)]
        .filter((part) => part.isWordLike);
    if (!plan.events.length && message.content.trim())
        return {
            ...plan,
            events: [{ text: message.content.trim(), wordId: null, start: 0, midi: null }],
        };
    const events = plan.events.map((event) => ({ ...event }));
    if (words[0] && events[0])
        events[0].text = message.content.slice(0, words[0].index).trim() + events[0].text;
    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
        let finalEvent = -1;
        for (let index = 0; index < events.length; index += 1)
            if (events[index].wordId === wordIndex) finalEvent = index;
        if (finalEvent === -1) continue;
        const end = words[wordIndex].index + words[wordIndex].segment.length;
        const next = words[wordIndex + 1]?.index ?? message.content.length;
        events[finalEvent].text += message.content.slice(end, next).trim();
    }
    return { ...plan, events };
}

export function buildChannelStaffs(messages: Message[], availableWidth: number) {
    const width = Math.min(CHANNEL_STAFF_WIDTH, Math.max(1, availableWidth));
    return [...messages]
        .sort((left, right) =>
            Date.parse(left.creation_date) - Date.parse(right.creation_date) ||
            (left.id ?? 0) - (right.id ?? 0),
        )
        .flatMap((message, messageIndex) => {
            const settings = withInstrumentProfile(
                CHANNEL_SOUND_SETTINGS,
                messageInstrument(message),
            );
            const plan = createSoundPlan(message.content, settings);
            const rows = layoutSoundStaff(displayPlan(message, plan), settings, Math.max(1, width - 40)).rows;
            return rows.filter((row) => row.length).map((row, rowIndex) => ({
                key: `${message.id ?? `${message.creation_date}-${message.user_id}-${messageIndex}`}-${rowIndex}`,
                message,
                plan,
                row: row.map((group) => ({ ...group, x: group.x + 20 })),
                first: rowIndex === 0,
            }));
        });
}

export function paginateChannelStaffs(
    blocks: ChannelStaffBlock[],
    availableHeight: number,
) {
    const pages: ChannelStaffBlock[][] = [[]];
    let height = 0;
    for (const block of [...blocks].reverse()) {
        const blockHeight = CHANNEL_STAFF_HEIGHT +
            (block.first ? CHANNEL_AUTHOR_HEIGHT : 0);
        const needed = (height ? CHANNEL_STAFF_GAP : 0) + blockHeight;
        if (height && height + needed > availableHeight) {
            pages.push([]);
            height = 0;
        }
        pages.at(-1)!.push(block);
        height += (height ? CHANNEL_STAFF_GAP : 0) + blockHeight;
    }
    return pages.map((page) => page.reverse());
}
