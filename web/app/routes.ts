import {
    type RouteConfig,
    index,
    layout,
    route,
} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    layout("routes/guest.tsx", [
        route("bienvenue", "routes/welcome/index.tsx"),
        route("login", "routes/login/index.tsx"),
        route("forgot-password", "routes/forgot-password/index.tsx"),
        route("register", "routes/register/index.tsx"),
    ]),
    route("profil", "routes/profile.tsx"),
    route("profil/instrument", "routes/instrument.tsx"),
    route("groupes/nouveau", "routes/new-channel.tsx"),
    route("channels/:channelId", "routes/channel.tsx"),
    route("atelier-son", "routes/sound-lab.tsx"),
] satisfies RouteConfig;
