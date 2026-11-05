import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import App from '../app/root'
import ChannelPage from '../app/routes/channel'
import Home from '../app/routes/home'
import Login from '../app/routes/login'
import Register from '../app/routes/register'

export function renderApp(path = '/') {
    const router = createMemoryRouter([
        {
            element: <App />,
            children: [
                { path: '/', element: <Home /> },
                { path: '/login', element: <Login /> },
                { path: '/register', element: <Register /> },
                { path: '/channels/:channelId', element: <ChannelPage /> },
            ],
        },
    ], { initialEntries: [path] })

    return render(<RouterProvider router={router} />)
}
