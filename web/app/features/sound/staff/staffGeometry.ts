import { STAFF_GEOMETRY, type StaffSettings } from "./staffConfig";

export function getStaffLinePath(index: number, settings: StaffSettings) {
    const {
        height,
        lineCount,
        startX,
        leftHandleX1,
        leftHandleX2,
        centerX,
        rightHandleX1,
        rightHandleX2,
        endX,
    } = STAFF_GEOMETRY;
    const y = height / 2 + (index - (lineCount - 1) / 2) * settings.spacing;

    return `M ${startX} ${y} C ${leftHandleX1} ${y - settings.curvature} ${leftHandleX2} ${y - settings.curvature} ${centerX} ${y} C ${rightHandleX1} ${y + settings.curvature} ${rightHandleX2} ${y + settings.curvature} ${endX} ${y}`;
}
