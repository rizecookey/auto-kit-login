import browser from 'webextension-polyfill';
import { CookieLoginDetectorConfig, IsRedirectedLoginDetectorConfig, LoginDetectorConfig } from './config';

class LoginDetector<T extends LoginDetectorConfig> {
    #config: T;
    constructor(config: T) {
        this.#config = {...(config || {})};
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        return false;
    }

    getConfig(): T {
        return {...this.#config};
    }
}

class SessionCookieLoginDetector extends LoginDetector<CookieLoginDetectorConfig> {
    #cookieRequiredRegex;
    constructor(config: CookieLoginDetectorConfig) {
        super(config);
        this.#cookieRequiredRegex = this.getConfig().options.cookie;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        return (await browser.cookies.getAll({
            domain: domain
        })).find(cookie => cookie.name.match(this.#cookieRequiredRegex)) ? true : false;
    }
}

class IsRedirectedLoginDetector extends LoginDetector<IsRedirectedLoginDetectorConfig> {
    #from;
    #to;
    constructor(options: IsRedirectedLoginDetectorConfig) {
        super(options);
        this.#from = options.options.from;
        this.#to = options.options.to;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        let response = await fetch(this.#from, { method: 'GET' });
        let url = new URL(response.url);
        return url.origin + url.pathname != this.#to;
    }
}

function getLoginDetector(config: LoginDetectorConfig): LoginDetector<any> {
    switch (config.type) {
        case 'is_redirected':
            return new IsRedirectedLoginDetector(config);
        case 'cookie':
        default:
            return new SessionCookieLoginDetector(config);
    }
}

export { getLoginDetector }