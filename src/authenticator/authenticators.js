class DefaultAuthenticator {
    #name;

    constructor(name, pageId) {
        this.#name = name;
    }

    getName() {
        return this.#name;
    }

    async authenticate(pageUrl) {
        // TODO implement opening login page somewhere
        throw new Error("Not implemented");
    }
}

function getAuthenticator(type, pageId) {
    return new DefaultAuthenticator(type, pageId);
}

module.exports = {
    getAuthenticator
}