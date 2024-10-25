import browser from 'webextension-polyfill';
import { CookieLoginDetectorConfig, IsRedirectedLoginDetectorConfig, LoginDetectorConfig } from './config';

abstract class LoginDetector<T extends LoginDetectorConfig> {
    protected config: T;

    constructor(config: T) {
        this.config = {...(config || {})};
    }

    abstract isLoggedIn(domain: string): Promise<boolean>;

    protected getConfig(): T {
        return {...this.config};
    }
}

class SessionCookieLoginDetector extends LoginDetector<CookieLoginDetectorConfig> {
    private cookieRequiredRegex: RegExp;

    constructor(config: CookieLoginDetectorConfig) {
        super(config);
        this.cookieRequiredRegex = this.getConfig().options.cookie;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        return (await browser.cookies.getAll({
            domain: domain
        })).find(cookie => cookie.name.match(this.cookieRequiredRegex)) ? true : false;
    }
}

class IsRedirectedLoginDetector extends LoginDetector<IsRedirectedLoginDetectorConfig> {
    private from: string;
    private to: string;

    constructor(options: IsRedirectedLoginDetectorConfig) {
        super(options);
        this.from = options.options.from;
        this.to = options.options.to;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        let response = await fetch(this.from, { method: 'GET' });
        let url = new URL(response.url);
        return url.origin + url.pathname != this.to;
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

export { getLoginDetector, LoginDetector }