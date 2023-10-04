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

        console.log(`sending login form to ${loginUrl}`);
        return await fetch(loginUrl, {
            method: 'POST',
            headers: config.loginSequence.postHeaders,
            body: loginForm
        });
    }

    async autoSubmitForm(response) {
        let doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        let form = doc.forms[0];

        let formData = new URLSearchParams();
        let responseURL = new URL(response.url);
        let url = new URL(form.getAttribute('action'), responseURL.origin + responseURL.pathname).toString();
        let elementsCollection = form.getElementsByTagName('input');
        for (let i = 0; i < elementsCollection.length; i++) {
            let element = elementsCollection.item(i);
            formData.append(element.name, element.value); 
        }

        console.log(`auto-submitting form from ${response.url} to ${url}`);
        return await fetch(url, {
            method: 'POST',
            headers: this.getAuthConfig().postHeaders,
            body: formData
        });
    }
    
    async getFormDetails(username, password, fetchResponse) {
        let doc = new DOMParser().parseFromString(await fetchResponse.text(), 'text/html');
        let csrfToken = this.getCSRFToken(doc);
    
        let formData = new URLSearchParams();
        formData.append(this.#fieldNames.csrfToken, csrfToken);
        formData.append(this.#fieldNames.username, username);
        formData.append(this.#fieldNames.password, password);
        formData.append(this.#fieldNames.eventIdProceed, '');
    
        return formData;
    }
    
    getCSRFToken(document) {
        let value = document.querySelector(`input[name="${this.#fieldNames.csrfToken}"]`).value;
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