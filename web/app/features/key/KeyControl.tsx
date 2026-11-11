import type { KeyState } from "./keyState";

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
        <div className="channel-key-control">
            <label className="channel-key-label">
                <input
                    type="checkbox"
                    aria-label="Clé récupérée"
                    checked={state.holderId !== null}
                    disabled={
                        busy ||
                        (state.holderId !== null && state.holderId !== userId)
                    }
                    onChange={onChange}
                />
                <img className="channel-key-star" src="/pictos/star.svg" alt="" />
                {state.holderId !== null && (
                    <img className="channel-key-symbol" src="/pictos/key.svg" alt="" />
                )}
            </label>
            <span className="channel-screen-reader" role="status">
                {state.holderName
                    ? `Clé détenue par ${state.holderName}`
                    : "Clé disponible"}
            </span>
        </div>
    );
}
