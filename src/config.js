const config = {
    pages: {
        ilias: {
            name: 'ILIAS',
            hostname: 'ilias.studium.kit.edu',
            loginPage: 'https://ilias.studium.kit.edu/shib_login.php?target=root_1',
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: '_shibsession.*'
                }
            }
        },
        campus: {
            name: 'KIT Campus',
            hostname: 'campus.studium.kit.edu',
            loginPage: 'https://campus.studium.kit.edu/Shibboleth.sso/Login',
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: '_shibsession.*'
                }
            }
        },
        'my-scc': {
            name: 'My SCC',
            hostname: 'my.scc.kit.edu',
            loginPage: 'https://my.scc.kit.edu/shib/index.php',
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: '_shibsession.*'
                }
            }
        },
        'campus-plus': {
            name: 'KIT Campus Plus',
            hostname: 'plus.campus.kit.edu',
            loginPage: 'https://plus.campus.kit.edu/api/user/oidc-login',
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: '\\.AspNetCore\\.Identity\\.Application'
                }
            }
        },
        'wiwi-portal': {
            name: 'KIT WiWi-Portal',
            hostname: 'portal.wiwi.kit.edu',
            loginPage: 'https://portal.wiwi.kit.edu/Account/LoginOpenIdConnect',
            authenticator: 'default',
            loginDetector: {
                type: 'cookie',
                options: {
                    cookie: '\\.AspNet\\.SharedCookie'
                }
            }
        },
        gitlab: {
            name: 'KIT GitLab',
            hostname: 'gitlab.kit.edu',
            loginPage: 'https://gitlab.kit.edu/users/sign_in',
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
    idpUrl: 'https://idp.scc.kit.edu/idp',
    filters: {
        login: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SSO**',
        logout: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SLO**'
    },
    extension: {
        pageParameters: {
            redirect: 'redirect_to',
            pageDetailsId: 'page_config',
        }
    }
}

function getConfig() {
    return config;
}

function getAutologinPageFilters() {
    let filters = [];
    for (let page in config.pages) {
        filters.push({
            hostContains: config.pages[page].hostname
        });
    }

    return filters;
}

module.exports = { getConfig, getAutologinPageFilters }