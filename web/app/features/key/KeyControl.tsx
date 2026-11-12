import type { KeyState } from "./keyState";

export default function KeyControl({
    state,
    userId,
    busy,
    ready,
    onChange,
}: {
    state: KeyState;
    userId: number;
    busy: boolean;
    ready: boolean;
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
                        !ready || busy ||
                        (state.holderId !== null && state.holderId !== userId)
                    }
                    onChange={onChange}
                />
                <img className="channel-key-star" src="/pictos/star.svg" alt="" />
                {ready && (
                    <img className="channel-key-symbol" src="/pictos/key.svg" alt=""
                        style={{ visibility: state.holderId === null ? "visible" : "hidden" }} />
                )}
            </label>
            <span className="channel-screen-reader" role="status">
                {!ready
                    ? "Chargement de la clé…"
                    : state.holderId === null
                    ? "Clé disponible"
                    : `Clé détenue par ${state.holderName || "un utilisateur"}`}
            </span>
        </div>
    );
}
