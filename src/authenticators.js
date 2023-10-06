const configLoader = require('./config');
const { InvalidLoginError } = require('./error_types');

const config = configLoader.getConfig();
const domParser = new DOMParser();

const idpUrl = config.idpUrl;

const loginFormPostHeaders = {
    postHeaders: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
}

class DefaultAuthenticator {
    static DEFAULT_AUTH_CONFIG = config.authenticators['default'];
    static FIELD_NAMES = {
        csrfToken: 'csrf_token',
        username: 'j_username',
        password: 'j_password',
        eventIdProceed: '_eventId_proceed'
    };

    #name;
    #authConfig;

    constructor(name) {
        this.#name = name;
        let defaultCopy = JSON.parse(JSON.stringify(DefaultAuthenticator.DEFAULT_AUTH_CONFIG));
        let specificCopy = JSON.parse(JSON.stringify(config.authenticators[this.#name]))
        this.#authConfig = { ...defaultCopy, ...specificCopy };
    }

    getName() {
        return this.#name;
    }
    
    getAuthConfig() {
        return this.#authConfig;
    }

    async authenticate(username, password, pageUrl) {
        return (await this.makeIdpLoginRequest(username, password, pageUrl)).ok;
    }

    async makeIdpLoginRequest(username, password, pageUrl) {
        let loginPageResponse = await fetch(pageUrl);
        let loginUrl = loginPageResponse.url;

        let loginDoc = await parseResponseToDoc(loginPageResponse);
        if (!this.hasLoginForm(loginDoc)) {
            console.log('IDP login skipped');
            return loginPageResponse;
        }

        let loginForm = await this.getFormDetails(username, password, loginDoc);

        console.log(`sending login form to ${loginUrl}`);
        let formPostResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: loginFormPostHeaders,
            body: loginForm
        });

        let responseDoc = await parseResponseToDoc(formPostResponse);
        if (this.hasLoginForm(responseDoc)) { // means we're still on the login page
            throw new InvalidLoginError();
        }

        return await this.autoSubmitForm(formPostResponse.url, responseDoc);
    }

    hasLoginForm(doc) {
        return getInputField(doc, DefaultAuthenticator.FIELD_NAMES.username)
                && getInputField(doc, DefaultAuthenticator.FIELD_NAMES.password);
    }

    async autoSubmitForm(originalUrl, doc) {
        let form = doc.forms[0];

        let formData = new URLSearchParams();
        let responseURL = new URL(originalUrl);
        let url = new URL(form.getAttribute('action'), responseURL.origin + responseURL.pathname).toString();
        let elementsCollection = form.getElementsByTagName('input');
        for (let i = 0; i < elementsCollection.length; i++) {
            let element = elementsCollection.item(i);
            formData.append(element.name, element.value); 
        }

        console.log(`auto-submitting form from ${originalUrl} to ${url}`);
        return await fetch(url, {
            method: 'POST',
            headers: loginFormPostHeaders,
            body: formData
        });
    }
    
    async getFormDetails(username, password, doc) {
        let csrfToken = this.getCSRFToken(doc);
    
        let formData = new URLSearchParams();
        formData.append(DefaultAuthenticator.FIELD_NAMES.csrfToken, csrfToken);
        formData.append(DefaultAuthenticator.FIELD_NAMES.username, username);
        formData.append(DefaultAuthenticator.FIELD_NAMES.password, password);
        formData.append(DefaultAuthenticator.FIELD_NAMES.eventIdProceed, '');
    
        return formData;
    }
    
    getCSRFToken(document) {
        let value = getInputField(document, DefaultAuthenticator.FIELD_NAMES.csrfToken).value;
        return value;
    }
}

class OIDCAuthenticator extends DefaultAuthenticator {
    async authenticate(username, password, pageUrl) {
        let loginResponse = await this.makeIdpLoginRequest(username, password, pageUrl);

        let responseDoc = await parseResponseToDoc(loginResponse);
        return (await this.autoSubmitForm(loginResponse.url, responseDoc)).ok;
    }
}

async function parseResponseToDoc(response) {
    return domParser.parseFromString(await response.text(), 'text/html');
}

function getInputField(doc, name) {
    return doc.querySelector(`input[name=${name}]`);
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