import browser from 'webextension-polyfill';

class LoginDetector {
    #options;
    constructor(options) {
        this.#options = {...(options || {})};
    }

    async isLoggedIn(domain) {
        return false;
    }

    getOptions() {
        return {...this.#options};
    }
}

class SessionCookieLoginDetector extends LoginDetector {
    #cookieRequiredRegex;
    constructor(options) {
        super(options);
        this.#cookieRequiredRegex = this.getOptions().cookie;
    }

    async isLoggedIn(domain) {
        return (await browser.cookies.getAll({
            domain: domain
        })).find(cookie => cookie.name.match(this.#cookieRequiredRegex));
    }
}

class IsRedirectedLoginDetector extends LoginDetector {
    #from;
    #to;
    constructor(options) {
        super(options);
        this.#from = options.from;
        this.#to = options.to;
    }

    async isLoggedIn(domain) {
        let response = await fetch(this.#from, { method: 'GET' });
        let url = new URL(response.url);
        return url.origin + url.pathname != this.#to;
    }
}

function getLoginDetector(config) {
    switch (config.type) {
        case 'is_redirected':
            return new IsRedirectedLoginDetector(config.options);
        case 'cookie':
        default:
            return new SessionCookieLoginDetector(config.options);
    }
}

export { getLoginDetector }