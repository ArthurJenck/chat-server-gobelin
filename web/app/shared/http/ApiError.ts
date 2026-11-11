export class ApiError extends Error {
    constructor(public status: number) {
        super(
            status === 401
                ? "Identifiants invalides ou session expirée."
                : "La requête a échoué. Réessaie plus tard.",
        );
    }
}
