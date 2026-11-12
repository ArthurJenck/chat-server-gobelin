import {
    type RouteConfig,
    index,
    layout,
    route,
} from "@react-router/dev/routes";

export default [
    index("routes/home/index.tsx"),
    layout("routes/guest.tsx", [
        route("bienvenue", "routes/welcome/index.tsx"),
        route("login", "routes/login/index.tsx"),
        route("forgot-password", "routes/forgot-password/index.tsx"),
        route("register", "routes/register/index.tsx"),
    ]),
    route("profil", "routes/profile/index.tsx"),
    route("profil/instrument", "routes/instrument.tsx"),
    route("profil/confirmation", "routes/confirmation/index.tsx"),
    route("groupes/nouveau", "routes/new-channel/index.tsx"),
    route("groupes/nouveau/:action", "routes/new-channel/index.tsx", { id: "routes/new-channel/form" }),
    route("channels/:channelId", "routes/channel/index.tsx"),
    route("atelier-son", "routes/sound-lab.tsx"),
] satisfies RouteConfig;
