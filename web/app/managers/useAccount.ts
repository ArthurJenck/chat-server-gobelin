import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError, getAccount, getToken, type Account } from "../api";
import { PATHS } from "../config";
import { accountInstrument } from "./profile";

export function useAccount(requireInstrument = true) {
    const navigate = useNavigate();
    const [account, setAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!getToken()) {
            void navigate(PATHS.login, { replace: true });
            return;
        }
        let active = true;
        getAccount()
            .then((result) => {
                if (!active) return;
                if (requireInstrument && !accountInstrument(result))
                    void navigate(PATHS.instrument, { replace: true });
                else setAccount(result);
            })
            .catch((cause: unknown) => {
                if (!active) return;
                if (cause instanceof ApiError && cause.status === 401)
                    void navigate(PATHS.login, { replace: true });
                else
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : "Compte indisponible.",
                    );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [navigate, requireInstrument]);

    return { account, loading, error };
}
