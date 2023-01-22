const Constants = {
    URL: {
        ILIAS: 'ilias.studium.kit.edu',
        CAMPUS_KIT: 'campus.studium.kit.edu',
        MY_SCC: 'my.scc.kit.edu'
    },

    IDP_URL: 'https://idp.scc.kit.edu/idp',

    Param: {
        REDIRECT: 'redirect_to',
        LOGIN_URL: 'login_url',
    },

    Field: {
        CSRF_TOKEN: 'csrf_token',
        USERNAME: 'j_username',
        PASSWORD: 'j_password',
        EVENT_ID_PROCEED: '_eventId_proceed',
        RELAY_STATE: 'RelayState',
        SAML_RESPONSE: 'SAMLResponse'
    },

    POST_HEADERS: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
}

let map = new Map();
map.set(Constants.URL.ILIAS, 'https://ilias.studium.kit.edu/shib_login.php?target=root_1');
map.set(Constants.URL.CAMPUS_KIT, 'https://campus.studium.kit.edu/Shibboleth.sso/Login');
map.set(Constants.URL.MY_SCC, 'https://my.scc.kit.edu/shib/index.php');

Constants.LOGIN_PAGES = map;

module.exports = Constants;