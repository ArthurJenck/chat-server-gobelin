import { createContext, useContext, useState } from "react";
import type { Instrument } from "../sound/soundConfig";

type Registration = {
    username: string;
    password: string;
};

type RegistrationContextValue = {
    registration: Registration | null;
    setRegistration: (registration: Registration | null) => void;
    selectedInstrument: Instrument | null;
    setSelectedInstrument: (instrument: Instrument | null) => void;
};

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function useRegistration() {
    const context = useContext(RegistrationContext);
    if (!context) throw new Error("Registration context unavailable");
    return context;
}

export default function RegistrationProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [registration, setRegistration] = useState<Registration | null>(null);
    const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);

    return (
        <RegistrationContext.Provider
            value={{ registration, setRegistration, selectedInstrument, setSelectedInstrument }}
        >
            {children}
        </RegistrationContext.Provider>
    );
}
