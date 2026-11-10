import { STAFF_GEOMETRY, type StaffSettings } from "./staffConfig";
import { getStaffLinePath } from "./staffGeometry";
import { useStaffAnimation } from "./useStaffAnimation";

export default function MessageStaff({
    user,
    settings,
}: {
    user: string;
    settings: StaffSettings;
}) {
    const { paths, currentSettings } = useStaffAnimation(settings);

    return (
        <svg
            role="img"
            aria-label={`Portée de ${user}`}
            viewBox={`0 0 ${STAFF_GEOMETRY.width} ${STAFF_GEOMETRY.height}`}
            width={STAFF_GEOMETRY.width}
            height={STAFF_GEOMETRY.height}
            style={{ display: "block", maxWidth: "100%" }}
        >
            {Array.from({ length: STAFF_GEOMETRY.lineCount }, (_, index) => (
                <path
                    key={index}
                    ref={(path) => {
                        paths.current[index] = path;
                    }}
                    d={getStaffLinePath(index, currentSettings.current)}
                    fill="none"
                    stroke="black"
                    strokeWidth={currentSettings.current.thickness}
                />
            ))}
        </svg>
    );
}
