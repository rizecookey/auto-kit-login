import browser from 'webextension-polyfill';
import { ApiRequestLoginDetectorConfig, CookieLoginDetectorConfig, IsRedirectedLoginDetectorConfig, LoginDetectorConfig } from './config';
import loginUtils from './bridged/login_utils';

abstract class LoginDetector<T extends LoginDetectorConfig> {
    protected pageId: string;
    protected config: T;

    constructor(pageId: string, config: T) {
        this.pageId = pageId;
        this.config = {...(config || {})};
    }

    isLoggedIn(domain: string): Promise<boolean> {
        return loginUtils.isLoggedIn(this.pageId);
    }

    protected getConfig(): T {
        return {...this.config};
    }
}

class SessionCookieLoginDetector extends LoginDetector<CookieLoginDetectorConfig> {
    private cookieRequiredRegex: RegExp;

    constructor(pageId: string, config: CookieLoginDetectorConfig) {
        super(pageId, config);
        this.cookieRequiredRegex = this.getConfig().options.cookie;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        if (await super.isLoggedIn(domain)) {
            return true;
        }
        
        return (await browser.cookies.getAll({
            domain: domain
        })).find(cookie => cookie.name.match(this.cookieRequiredRegex)) ? true : false;
    }
}

class ApiRequestLoginDetector extends LoginDetector<ApiRequestLoginDetectorConfig> {
    private url: URL;
    private responsePredicate: (receivedData: any) => boolean;

    constructor(pageId: string, config: ApiRequestLoginDetectorConfig) {
        super(pageId, config);
        this.url = this.getConfig().options.endpointUrl;
        this.responsePredicate = this.getConfig().options.responsePredicate;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        const lastLoginTime = await loginUtils.getLastLoginTime(this.pageId);
        if (lastLoginTime !== undefined && Date.now() - lastLoginTime < 1000 * 60 * 15) {
            return true;
        }

        const response = await fetch(this.url);
        const result = this.responsePredicate(await response.json());
        if (result) {
            await loginUtils.setLoggedIn([this.pageId, true]);
        }
        return result;
    }
}

class IsRedirectedLoginDetector extends LoginDetector<IsRedirectedLoginDetectorConfig> {
    private from: string;
    private to: string;

    constructor(pageId: string, options: IsRedirectedLoginDetectorConfig) {
        super(pageId, options);
        this.from = options.options.from;
        this.to = options.options.to;
    }

    async isLoggedIn(domain: string): Promise<boolean> {
        if (await super.isLoggedIn(domain)) {
            return true;
        }

        let response = await fetch(this.from, { method: 'GET' });
        let url = new URL(response.url);
        return url.origin + url.pathname != this.to;
    }
}

function getLoginDetector(pageId: string, config: LoginDetectorConfig): LoginDetector<any> {
    switch (config.type) {
        case 'api_request':
            return new ApiRequestLoginDetector(pageId, config);
        case 'is_redirected':
            return new IsRedirectedLoginDetector(pageId, config);
        case 'cookie':
        default:
            return new SessionCookieLoginDetector(pageId, config);
    }
}

export { getLoginDetector, LoginDetector }