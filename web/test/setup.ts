import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from 'msw/node'

export const server = setupServer()

beforeAll(() => server.listen())

afterEach(() => {
    cleanup()
    server.resetHandlers()
    window.localStorage.clear()
})

afterAll(() => server.close())
