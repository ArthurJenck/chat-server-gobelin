import { useEffect } from "react";
import { Leva, useControls } from "leva";
import {
    DEFAULT_STAFF_SETTINGS,
    STAFF_SETTING_RANGES,
    type StaffSettings,
} from "./staffConfig";

export default function StaffSettingsPanel({
    onChange,
}: {
    onChange: (settings: StaffSettings) => void;
}) {
    const controls = useControls("Atelier de la portée", {
        Courbure: {
            value: DEFAULT_STAFF_SETTINGS.curvature,
            ...STAFF_SETTING_RANGES.curvature,
        },
        Espacement: {
            value: DEFAULT_STAFF_SETTINGS.spacing,
            ...STAFF_SETTING_RANGES.spacing,
        },
        Épaisseur: {
            value: DEFAULT_STAFF_SETTINGS.thickness,
            ...STAFF_SETTING_RANGES.thickness,
        },
    });

    useEffect(() => {
        onChange({
            curvature: controls.Courbure,
            spacing: controls.Espacement,
            thickness: controls.Épaisseur,
        });
    }, [controls.Courbure, controls.Espacement, controls.Épaisseur, onChange]);

    return <Leva />;
}
