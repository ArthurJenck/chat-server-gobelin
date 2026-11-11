import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { getToken } from "../features/auth/token";
import { getAccount } from "../features/users/api";
import { accountInstrument } from "../features/users/instrument";
import { PATHS } from "../shared/config";

export default function Guest() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        if (!getToken()) return;

        let active = true;
        setChecking(true);
        getAccount()
            .then((account) => {
                if (!active) return;
                void navigate(
                    accountInstrument(account) ? PATHS.home : PATHS.instrument,
                    { replace: true },
                );
            })
            .catch(() => {
                if (active) setChecking(false);
            });

        return () => {
            active = false;
        };
    }, [navigate]);

    return checking ? null : <Outlet />;
}
