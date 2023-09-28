const config = {
    pages: [
        {
            name: 'ILIAS',
            hostname: 'ilias.studium.kit.edu',
            loginPage: 'https://ilias.studium.kit.edu/shib_login.php?target=root_1'
        },
        {
            name: 'KIT Campus',
            hostname: 'campus.studium.kit.edu',
            loginPage: 'https://campus.studium.kit.edu/Shibboleth.sso/Login'
        },
        {
            name: 'My SCC',
            hostname: 'my.scc.kit.edu',
            loginPage: 'https://my.scc.kit.edu/shib/index.php'
        }
    ],
    loginSequence: {
        url: {
            idp: 'https://idp.scc.kit.edu/idp',
            login: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SSO**',
            logout: 'https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SLO**'
        },
        cookies: {
            shibsession: '_shibsession'
        },
        field: {
            csrfToken: 'csrf_token',
            username: 'j_username',
            password: 'j_password',
            eventIdProceed: '_eventId_proceed',
            relayState: 'RelayState',
            samlResponse: 'SAMLResponse'
        },
        postHeaders: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    },
    extension: {
        pageParameters: {
            redirect: 'redirect_to',
            loginUrl: 'login_url'
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