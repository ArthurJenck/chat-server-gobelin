import type { Message } from "../messages/types";
import { withInstrumentProfile, DEFAULT_SOUND_SETTINGS } from "../sound/soundConfig";
import { createSoundPlan, type SoundPlan } from "../sound/soundPlan";
import { layoutSoundStaff } from "../sound/visual/staffLayout";
import { messageInstrument } from "./messageSound";
import { emotionMode, messageEmotion, type EmotionMode } from "./emotion";
import {
    DEFAULT_MUSIC_KEY,
    isConversationRest,
    messageMusicKey,
    type MusicKey,
} from "./conversationMusic";

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
    rowIndex: number;
    musicKey: MusicKey;
    pageKey: MusicKey;
    mode: EmotionMode;
};

export function buildChannelStaffs(messages: Message[], availableWidth: number) {
    const width = Math.min(CHANNEL_STAFF_WIDTH, Math.max(1, availableWidth));
    let musicKey = DEFAULT_MUSIC_KEY;
    return [...messages]
        .sort((left, right) =>
            Date.parse(left.creation_date) - Date.parse(right.creation_date) ||
            (left.id ?? 0) - (right.id ?? 0),
        )
        .flatMap((message, messageIndex) => {
            musicKey = messageMusicKey(message) ?? musicKey;
            const mode = emotionMode(messageEmotion(message));
            const settings = withInstrumentProfile(
                { ...CHANNEL_SOUND_SETTINGS, ...musicKey, mode },
                messageInstrument(message),
            );
            const silent = isConversationRest(message);
            const plan: SoundPlan = silent
                ? { events: [{ text: "", wordId: null, start: 0, midi: null, rest: "whole" }],
                    tonicMidi: 12 * (settings.octave + 1) + musicKey.root, density: 0,
                    noteStep: settings.intervalMs / 1000 }
                : createSoundPlan(message.content, settings);
            const rows = layoutSoundStaff(plan, settings, Math.max(1, width - 40)).rows;
            return rows.filter((row) => row.length).map((row, rowIndex) => ({
                key: `${message.id ?? `${message.creation_date}-${message.user_id}-${messageIndex}`}-${rowIndex}`,
                message,
                plan,
                row: row.map((group) => ({ ...group, x: silent ? width / 2 - 7.5 : group.x + 20 })),
                first: rowIndex === 0 && !silent,
                rowIndex,
                musicKey,
                pageKey: musicKey,
                mode,
            }));
        });
}

export function applyPageMusicKeys(pages: ChannelStaffBlock[][], availableWidth: number) {
    const width = Math.min(CHANNEL_STAFF_WIDTH, Math.max(1, availableWidth));
    return pages.map((page) => {
        const pageKey = page.at(-1)?.musicKey ?? DEFAULT_MUSIC_KEY;
        return page.map((block) => {
            if (isConversationRest(block.message)) return { ...block, pageKey };
            const settings = withInstrumentProfile(
                { ...CHANNEL_SOUND_SETTINGS, ...pageKey, mode: block.mode },
                messageInstrument(block.message),
            );
            const plan = createSoundPlan(block.message.content, settings);
            const row = layoutSoundStaff(plan, settings, Math.max(1, width - 40))
                .rows[block.rowIndex]?.map((group) => ({ ...group, x: group.x + 20 })) ?? [];
            return { ...block, pageKey, plan, row };
        });
    });
}

export function pageGradientKey(page: ChannelStaffBlock[]): MusicKey {
    const root = page.at(-1)?.pageKey.root ?? DEFAULT_MUSIC_KEY.root;
    const messages = new Map<string, EmotionMode>();
    for (const block of page) {
        if (isConversationRest(block.message)) continue;
        const identity = block.message.id ??
            `${block.message.creation_date}-${block.message.user_id}-${block.message.content}`;
        messages.set(String(identity), block.mode);
    }
    const minor = [...messages.values()].filter((mode) => mode === "minor").length;
    return { root, mode: minor > messages.size - minor ? "minor" : "major" };
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
