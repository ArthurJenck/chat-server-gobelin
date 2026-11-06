import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
    index('routes/home.tsx'),
    route('login', 'routes/login.tsx'),
    route('register', 'routes/register.tsx'),
    route('channels/:channelId', 'routes/channel.tsx'),
    route('atelier-son', 'routes/sound-lab.tsx'),
] satisfies RouteConfig
