const TOKEN_KEY = "gobelin_token";

export function getToken() {
    return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
}
