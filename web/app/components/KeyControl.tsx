import type { KeyState } from "../managers/key";

export default function KeyControl({
    state,
    userId,
    busy,
    onChange,
}: {
    state: KeyState;
    userId: number;
    busy: boolean;
    onChange: () => void;
}) {
    return (
        <section aria-labelledby="key-heading">
            <h2 id="key-heading">Clé de la salle</h2>
            <label>
                <input
                    type="checkbox"
                    checked={state.holderId !== null}
                    disabled={
                        busy ||
                        (state.holderId !== null && state.holderId !== userId)
                    }
                    onChange={onChange}
                />
                Clé récupérée
            </label>
            <p role="status">
                {state.holderName
                    ? `Clé détenue par ${state.holderName}`
                    : "Clé disponible"}
            </p>
        </section>
    );
}
