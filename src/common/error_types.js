class InvalidLoginError extends Error {
    constructor() {
        super('login unsuccessful, assuming invalid login');
    }
}

module.exports = { InvalidLoginError };