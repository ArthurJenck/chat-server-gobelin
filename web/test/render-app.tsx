import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import App from "../app/root";
import ChannelPage from "../app/routes/channel";
import Home from "../app/routes/home";
import Login from "../app/routes/login/index";
import Welcome from "../app/routes/welcome";
import Register from "../app/routes/register/index";
import SoundLab from "../app/routes/sound-lab";
import Profile from "../app/routes/profile";
import InstrumentPage from "../app/routes/instrument";
import NewChannel from "../app/routes/new-channel";

export function renderApp(path = "/") {
    const router = createMemoryRouter(
        [
            {
                element: <App />,
                children: [
                    { path: "/", element: <Home /> },
                    { path: "/bienvenue", element: <Welcome /> },
                    { path: "/login", element: <Login /> },
                    { path: "/register", element: <Register /> },
                    { path: "/profil", element: <Profile /> },
                    { path: "/profil/instrument", element: <InstrumentPage /> },
                    { path: "/groupes/nouveau", element: <NewChannel /> },
                    { path: "/channels/:channelId", element: <ChannelPage /> },
                    { path: "/atelier-son", element: <SoundLab /> },
                ],
            },
        ],
        { initialEntries: [path] },
    );

    return render(<RouterProvider router={router} />);
}
