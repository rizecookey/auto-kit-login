import browser, { Cookies, Events, WebNavigation, WebRequest } from 'webextension-polyfill'

interface Config {
    pages: {[key: string]: PageConfig},
    expirationExtendableCookies: {
        domains: string[],
        names: RegExp[]
    }[],
    idpUrl: string,
    filters: {
        login: string,
        logout: string
    },
    extension: {
        pageParameters: {
            redirect: string,
            pageDetailsId: string
        },
        userConfig: {
            loginWindowTypes: LoginWindowConfiguration
        },
        authenticationPage: string,
        sessionTimeoutDetectorsDir: string
    }
}

interface PageConfig {
    name: string,
    hostname: string,
    loginUrl: URL,
    logoutUrls?: {
        baseFilters: string[],
        isLogout?(details: WebRequest.OnCompletedDetailsType): boolean
    },
    authenticator: AuthenticatorType,
    loginDetector: LoginDetectorConfig,
    sessionTimeoutDetectors?: string[]
}

type AuthenticatorType = 'default' | 'fels';

type LoginWindowType = 'popup' | 'tab';
type LoginWindowConfiguration = {[Property in LoginWindowType]?: string};

type LoginDetectorConfig = CookieLoginDetectorConfig | ApiRequestLoginDetectorConfig | IsRedirectedLoginDetectorConfig;

interface CookieLoginDetectorConfig {
    type: 'cookie',
    options: {
        cookie: RegExp
    }
}

interface ApiRequestLoginDetectorConfig {
    type: 'api_request',
    options: {
        endpointUrl: URL,
        responsePredicate(receivedData: any): boolean
    }
}

interface IsRedirectedLoginDetectorConfig {
    type: 'is_redirected',
    options: {
        from: string,
        to: string
    }
}

let loginWindowConfiguration: LoginWindowConfiguration = {
    'tab': 'New tab'
};

if (browser.windows !== undefined) {
    loginWindowConfiguration['popup'] = 'Popup'
}

const config: Config = {
    pages: {
        ilias: {
            name: 'ILIAS',
            hostname: 'ilias.studium.kit.edu',
            loginUrl: new URL('https://ilias.studium.kit.edu/shib_login.php?target=root_1'),
            logoutUrls: {
                baseFilters: ['https://ilias.studium.kit.edu/ilias.php*cmd=showLogout*'],
                isLogout(details) {
                    return new URL(details.url).searchParams.get("cmd") == "showLogout";
                }
            },
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: /_shibsession.*/
                }
            },
            sessionTimeoutDetectors: ['ilias']
        },
        campus: {
            name: 'KIT Campus',
            hostname: 'campus.studium.kit.edu',
            loginUrl: new URL('https://campus.studium.kit.edu/Shibboleth.sso/Login'),
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: /_shibsession.*/
                }
            },
            sessionTimeoutDetectors: ['campus']
        },
        'my-scc': {
            name: 'My SCC',
            hostname: 'my.scc.kit.edu',
            loginUrl: new URL('https://my.scc.kit.edu/shib/index.php'),
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: /_shibsession.*/
                }
            }
        },
        'campus-plus': {
            name: 'KIT Campus Plus',
            hostname: 'plus.campus.kit.edu',
            loginUrl: new URL('https://plus.campus.kit.edu/api/user/oidc-login'),
            logoutUrls: { baseFilters: ['https://plus.campus.kit.edu/api/user/logout'] },
            authenticator: 'default',
            loginDetector: {
                type: 'api_request',
                options: {
                    endpointUrl: new URL('https://plus.campus.kit.edu/api/user/info'),
                    responsePredicate(receivedData: any) {
                        return receivedData !== null;
                    }
                }
            }
        },
        'wiwi-portal': {
            name: 'KIT WiWi-Portal',
            hostname: 'portal.wiwi.kit.edu',
            loginUrl: new URL('https://portal.wiwi.kit.edu/api/account/login-oidc'),
            logoutUrls: { baseFilters: ['https://portal.wiwi.kit.edu/api/account/logout'] },
            authenticator: 'default',
            loginDetector: {
                type: 'api_request',
                options: {
                    endpointUrl: new URL('https://portal.wiwi.kit.edu/api/initial-data/get-initial-data'),
                    responsePredicate(receivedData: any) {
                        return receivedData.data.userProfile !== null;
                    }
                }
            }
        },
        gitlab: {
            name: 'KIT GitLab',
            hostname: 'gitlab.kit.edu',
            loginUrl: new URL('https://gitlab.kit.edu/users/sign_in'),
            authenticator: 'fels',
            loginDetector: {
                type: 'is_redirected',
                options: {
                    from: 'https://gitlab.kit.edu/',
                    to: 'https://gitlab.kit.edu/users/sign_in'
                }
            }
        }
    },
    expirationExtendableCookies: [
        {
            domains: ['campus.studium.kit.edu', 'ilias.studium.kit.edu', 'my.scc.kit.edu'],
            names: [/_shibsession.*/, /PHPSESSID/]
        },
        {
            domains: ['idp.scc.kit.edu'],
            names: [/__Host-shib_idp_session/]
        }
    ],
    idpUrl: 'https://idp.scc.kit.edu/idp',
    filters: {
        login: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SSO**',
        logout: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SLO**'
    },
    extension: {
        pageParameters: {
            redirect: 'redirect_to',
            pageDetailsId: 'page_config',
        },
        userConfig: {
            loginWindowTypes: loginWindowConfiguration
        },
        authenticationPage: 'authenticator/authenticating.html',
        sessionTimeoutDetectorsDir: 'content/session_timeout_detectors'
    }
}

function getAutologinPageFilters(): WebNavigation.EventUrlFilters {
    let filters: Events.UrlFilter[] = [];
    for (let page in config.pages) {
        filters.push({
            hostContains: config.pages[page].hostname
        });
    }

    return { url: filters };
}

function getAutologinRequestFilters(): WebRequest.RequestFilter {
    let filters: string[] = [];
    for (let page in config.pages) {
        filters.push(`*://${config.pages[page].hostname}/*`);
    }

    return {
        urls: filters,
        types: ['main_frame']
    }
}

function getLogoutUrlFilters(): WebRequest.RequestFilter {
    return { urls: Object.values(config.pages).filter(page => page.logoutUrls !== undefined).flatMap(page => page.logoutUrls?.baseFilters!!) };
}

function findPageDetailsForDomain(domain: string): [string, PageConfig] | [undefined, undefined] {
    let found: [string, PageConfig] | [undefined, undefined] = [undefined, undefined];

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        if (domain.includes(page.hostname)) {
            found = [pageId, page];
        }
    }

    return found;
}

function isExpirationExtendableCookie(cookie: Cookies.Cookie): boolean {
    for (let cookieType of config.expirationExtendableCookies) {
        if (cookieType.domains.every(domain => cookie.domain !== domain)) {
            continue;
        }

        if (cookieType.names.some(regex => regex.test(cookie.name))) {
            return true;
        }
    }

    return false;
}

export { config, getAutologinPageFilters, getAutologinRequestFilters, getLogoutUrlFilters, findPageDetailsForDomain, isExpirationExtendableCookie, AuthenticatorType, LoginDetectorConfig, CookieLoginDetectorConfig, ApiRequestLoginDetectorConfig, IsRedirectedLoginDetectorConfig, PageConfig, Config, LoginWindowType }