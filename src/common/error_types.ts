class InvalidLoginError extends Error {
    constructor() {
        super('login unsuccessful, assuming invalid login');
    }
}

export { InvalidLoginError };