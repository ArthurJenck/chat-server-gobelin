import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PATHS } from "../../shared/config";
import { ApiError } from "../../shared/http/ApiError";
import { getAccount } from "../users/api";
import { accountInstrument } from "../users/instrument";
import type { Account } from "../users/types";
import { getToken } from "./token";

export function useAccount(requireInstrument = true, requireSession = true) {
    const navigate = useNavigate();
    const [account, setAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!getToken()) {
            if (requireSession) void navigate(PATHS.welcome, { replace: true });
            else setLoading(false);
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
                    void navigate(PATHS.welcome, { replace: true });
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
    }, [navigate, requireInstrument, requireSession]);

    return { account, loading, error };
}
