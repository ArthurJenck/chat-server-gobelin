export const NAMESPACE = "harmonie";
export const KEY_CHANNEL_NAME = "__harmonie_cle_salle";
export const MESSAGE_REFRESH_MS = 10_000;
export const PARIS_TIME_ZONE = "Europe/Paris";

export const PATHS = {
    home: "/",
    login: "/login",
    profile: "/profil",
    instrument: "/profil/instrument",
    newChannel: "/groupes/nouveau",
    channel: (id: number) => `/channels/${id}`,
} as const;
