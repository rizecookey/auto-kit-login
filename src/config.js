const config = {
    pages: [
        {
            name: 'ILIAS',
            hostname: 'ilias.studium.kit.edu',
            loginPage: 'https://ilias.studium.kit.edu/shib_login.php?target=root_1',
            authenticator: 'default'
        },
        {
            name: 'KIT Campus',
            hostname: 'campus.studium.kit.edu',
            loginPage: 'https://campus.studium.kit.edu/Shibboleth.sso/Login',
            authenticator: 'default'
        },
        {
            name: 'My SCC',
            hostname: 'my.scc.kit.edu',
            loginPage: 'https://my.scc.kit.edu/shib/index.php',
            authenticator: 'default'
        },
        {
            name: 'KIT Campus Plus',
            hostname: 'plus.campus.kit.edu',
            loginPage: 'https://plus.campus.kit.edu/api/user/oidc-login',
            authenticator: 'oidc-campus-plus'
        },
        {
            name: 'KIT WiWi-Portal',
            hostname: 'portal.wiwi.kit.edu',
            loginPage: 'https://portal.wiwi.kit.edu/Account/LoginOpenIdConnect',
            authenticator: 'oidc-wiwi'
        }
    ],
    idpUrl: 'https://idp.scc.kit.edu/idp',
    filters: {
        login: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SSO**',
        logout: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SLO**'
    },
    authenticators: {
        default: {
            cookies: {
                session: '_shibsession'
            }
        },
        'oidc-campus-plus': {
            cookies: {
                session: '.AspNetCore.Identity.Application'
            }
        },
        'oidc-wiwi': {
            cookies: {
                session: '.AspNet.SharedCookie'
            }
        },
        gitlab: {
            cookies: {
                session: '_shibsession'
            }
        }
    },
    extension: {
        pageParameters: {
            redirect: 'redirect_to',
            loginUrl: 'login_url',
            authenticatorType: 'type'
        }
    }
}

function getConfig() {
    return config;
}

function getAutologinPageFilters() {
    let filters = [];
    for (let page of config.pages) {
        filters.push({
            hostContains: page.hostname
        });
    }

    return filters;
}

module.exports = { getConfig, getAutologinPageFilters }