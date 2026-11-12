import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import App from "../app/root";
import ChannelPage from "../app/routes/channel/index";
import Home from "../app/routes/home/index";
import Login from "../app/routes/login/index";
import ForgotPassword from "../app/routes/forgot-password/index";
import Welcome from "../app/routes/welcome";
import Register from "../app/routes/register/index";
import SoundLab from "../app/routes/sound-lab";
import Profile from "../app/routes/profile/index";
import InstrumentPage from "../app/routes/instrument";
import Confirmation from "../app/routes/confirmation";
import NewChannel from "../app/routes/new-channel/index";
import Guest from "../app/routes/guest";

export function renderApp(path: string | string[] = "/") {
    const router = createMemoryRouter(
        [
            {
                element: <App />,
                children: [
                    { path: "/", element: <Home /> },
                    {
                        element: <Guest />,
                        children: [
                            { path: "/bienvenue", element: <Welcome /> },
                            { path: "/login", element: <Login /> },
                            { path: "/forgot-password", element: <ForgotPassword /> },
                            { path: "/register", element: <Register /> },
                        ],
                    },
                    { path: "/profil", element: <Profile /> },
                    { path: "/profil/instrument", element: <InstrumentPage /> },
                    { path: "/profil/confirmation", element: <Confirmation /> },
                    { path: "/groupes/nouveau", element: <NewChannel /> },
                    { path: "/groupes/nouveau/:action", element: <NewChannel /> },
                    { path: "/channels/:channelId", element: <ChannelPage /> },
                    { path: "/atelier-son", element: <SoundLab /> },
                ],
            },
        ],
        { initialEntries: Array.isArray(path) ? path : [path] },
    );

    return { ...render(<RouterProvider router={router} />), router };
}
