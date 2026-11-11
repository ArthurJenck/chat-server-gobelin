import type { ReactNode } from "react";
import { INSTRUMENTS, type Instrument } from "../features/sound/soundConfig";
import "../routes/confirmation/confirmation.css";

type ProfileSummaryProps = {
    username?: string;
    instrument: Instrument | null;
    onBack: () => void;
    onInstrumentClick?: () => void;
    children: ReactNode;
};

export default function ProfileSummary({
    username,
    instrument,
    onBack,
    onInstrumentClick,
    children,
}: ProfileSummaryProps) {
    return (
        <main className="confirmation-page">
            <button
                className="confirmation-back"
                type="button"
                aria-label="Retour"
                onClick={onBack}
            >
                <img src="/pictos/arrow.svg" alt="" />
            </button>
            <h1 className="confirmation-title">
                <span>Tu fais partie de</span>{" "}
                <span>la communauté</span>{" "}
                <span>Harmonie</span>
            </h1>
            <div className="confirmation-symbol" aria-hidden="true">
                <img className="confirmation-star" src="/pictos/star.svg" alt="" />
                <img className="confirmation-key" src="/pictos/key.svg" alt="" />
            </div>
            {username && instrument && (
                <div className="confirmation-details">
                    <p>{username}</p>
                    {onInstrumentClick ? (
                        <button
                            className="confirmation-detail-button"
                            type="button"
                            aria-label={`Modifier l’instrument : ${INSTRUMENTS[instrument].label}`}
                            onClick={onInstrumentClick}
                        >
                            {INSTRUMENTS[instrument].label}
                        </button>
                    ) : (
                        <p>{INSTRUMENTS[instrument].label}</p>
                    )}
                </div>
            )}
            {children}
        </main>
    );
}
