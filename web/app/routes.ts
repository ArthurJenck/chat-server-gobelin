import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("bienvenue", "routes/welcome.tsx"),
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
    route("profil", "routes/profile.tsx"),
    route("profil/instrument", "routes/instrument.tsx"),
    route("groupes/nouveau", "routes/new-channel.tsx"),
    route("channels/:channelId", "routes/channel.tsx"),
    route("atelier-son", "routes/sound-lab.tsx"),
] satisfies RouteConfig;
