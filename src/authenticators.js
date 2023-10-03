let $ = require('jquery');
let browser = require('webextension-polyfill');
const configLoader = require('./config');
const config = configLoader.getConfig();

class DefaultAuthenticator {
    static DEFAULT_AUTH_CONFIG = config.authenticators['default'];
    static DEFAULT_FIELD_NAMES = this.DEFAULT_AUTH_CONFIG.field;

    #name;
    #authConfig;
    #fieldNames;

    constructor(name) {
        this.#name = name;
        let defaultCopy = JSON.parse(JSON.stringify(DefaultAuthenticator.DEFAULT_AUTH_CONFIG));
        let specificCopy = JSON.parse(JSON.stringify(config.authenticators[this.#name]))
        this.#authConfig = { ...defaultCopy, ...specificCopy };
        this.#fieldNames = this.#authConfig.field;

        console.log(this.#authConfig);
    }

    getName() {
        return this.#name;
    }
    
    getAuthConfig() {
        return this.#authConfig;
    }

    getFieldNames() {
        return this.#fieldNames;
    }

    isLoggedIn(cookies) {
        return cookies.find(cookie => 
            cookie.name.startsWith(this.#authConfig.cookies.session));
    }

    async authenticate(username, password, pageUrl) {
        let loginResponse = await this.makeLoginRequest(username, password, pageUrl);

        return (await this.autoSubmitForm(loginResponse)).ok;
    }

    async makeLoginRequest(username, password, pageUrl) {
        let loginPageResponse = await fetch(pageUrl);
        let loginUrl = loginPageResponse.url;
        let loginForm = await this.getFormDetails(username, password, loginPageResponse);

        return await fetch(loginUrl, {
            method: 'POST',
            headers: config.loginSequence.postHeaders,
            body: loginForm
        });
    }

    async autoSubmitForm(response) {
        let doc = $(await response.text());
        let form = doc.filter('form').first();

        let formData = new URLSearchParams();
        let url = form.attr('action');
        form.find('input').each((index, child) => {
            formData.append(child.name, child.value);
        });

        return await fetch(url, {
            method: 'POST',
            headers: this.getAuthConfig().postHeaders,
            body: formData
        });
    }
    
    async getFormDetails(username, password, fetchResponse) {
        let csrfToken = this.getCSRFToken(await fetchResponse.text());
    
        let formData = new URLSearchParams();
        formData.append(this.#fieldNames.csrfToken, csrfToken);
        formData.append(this.#fieldNames.username, username);
        formData.append(this.#fieldNames.password, password);
        formData.append(this.#fieldNames.eventIdProceed, '');
    
        return formData;
    }
    
    getCSRFToken(domString) {
        let value = $(`input[name="${this.#fieldNames.csrfToken}"]`, $(domString)).val();
        return value;
    }
}

class OIDCAuthenticator extends DefaultAuthenticator {
    isLoggedIn(cookies) {
        return cookies.find(cookie => 
            cookie.name.startsWith(this.getAuthConfig().cookies.session));
    }

    async authenticate(username, password, pageUrl) {
        let loginResponse = await this.makeLoginRequest(username, password, pageUrl);
    
        let samlResponse = await this.autoSubmitForm(loginResponse);

        return (await this.autoSubmitForm(samlResponse)).ok;
    }
}

function getAuthenticator(type) {
    switch (type) {
        case 'oidc-campus-plus':
        case 'oidc-wiwi':
            return new OIDCAuthenticator(type);
        case 'gitlab':
        case 'default':
        default:
            return new DefaultAuthenticator(type);
    }
}

module.exports = {
    getAuthenticator
}