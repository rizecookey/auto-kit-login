const { InvalidLoginError } = require('../error_types');

const domParser = new DOMParser();

const loginFormPostHeaders = {
    postHeaders: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
}

class DefaultAuthenticator {
    static FIELD_NAMES = {
        csrfToken: 'csrf_token',
        username: 'j_username',
        password: 'j_password',
        eventIdProceed: '_eventId_proceed'
    };

    #name;

    constructor(name, pageId) {
        this.#name = name;
    }

    getName() {
        return this.#name;
    }

    async authenticate(username, password, pageUrl) {
        return (await this.makeIdpLoginRequest(username, password, pageUrl)).ok;
    }

    async makeIdpLoginRequest(username, password, pageUrl) {
        let loginPageResponse = await fetch(pageUrl);
        let loginUrl = loginPageResponse.url;

        let responseClone = loginPageResponse.clone();

        let loginDoc = await parseResponseToDoc(loginPageResponse);
        if (!this.hasLoginForm(loginDoc)) {
            console.log('IDP login skipped');
            return responseClone;
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

        let formData = this.scrapePresetFormDetails(doc, 0);
        let responseURL = new URL(originalUrl);
        let url = new URL(form.getAttribute('action'), responseURL.origin + responseURL.pathname).toString();

        console.log(`auto-submitting form from ${originalUrl} to ${url}`);
        return await fetch(url, {
            method: 'POST',
            headers: loginFormPostHeaders,
            body: formData
        });
    }

    scrapePresetFormDetails(doc, formId) {
        let formData = new URLSearchParams();

        let form = doc.forms[formId];
        let elementsCollection = form.getElementsByTagName('input');
        for (let i = 0; i < elementsCollection.length; i++) {
            let element = elementsCollection.item(i);
            formData.append(element.name, element.value);
        }

        return formData;
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

class FELSAuthenticator extends DefaultAuthenticator {
    static LOGIN_PAGE = "https://fels.scc.kit.edu/Shibboleth.sso/Login";
    static FELS_FORM_SELECT_KIT = {
        'jakarta.faces.partial.ajax': 'true',
        'jakarta.faces.source': 'searchAutocompl',
        'jakarta.faces.partial.execute': 'searchAutocompl',
        'jakarta.faces.partial.render': 'form',
        'jakarta.faces.behavior.event': 'valueChange',
        'jakarta.faces.partial.event': 'change',
        'form': 'form',
        'searchAutocompl_input': 'Karlsruher+Institut+für+Technologie+(KIT)',
        'searchAutocompl_hinput': '1002'
    };
    static FELS_FORM_SEND_KIT = {
        'jakarta.faces.partial.ajax': 'true',
        'jakarta.faces.source': 'login',
        'jakarta.faces.partial.execute': '@all',
        'jakarta.faces.partial.render': 'form',
        'login': 'login',
        'form': 'form',
        'searchAutocompl_input': 'Karlsruher+Institut+für+Technologie+(KIT)',
        'searchAutocompl_hinput': '1002'
    }

    static VIEWSTATE_FIELD = "jakarta.faces.ViewState";

    async authenticate(username, password, pageUrl) {
        let signInPageResponse = await this.initiateAuthentication(pageUrl);
        if (signInPageResponse.ok && new URL(signInPageResponse.url).hostname != new URL(FELSAuthenticator.LOGIN_PAGE).hostname) {
            return signInPageResponse;
        }

        await this.selectKITOnFELSPage(signInPageResponse);
        
        return (await this.makeIdpLoginRequest(username, password, FELSAuthenticator.LOGIN_PAGE)).ok;
    }

    async initiateAuthentication(pageUrl) {
        console.log(`loading login page from ${pageUrl}`);
        let pageLoadResponse = await fetch(pageUrl, {
            method: 'GET'
        });

        let document = await parseResponseToDoc(pageLoadResponse);

        return await this.autoSubmitForm(pageUrl, document);
    }

    async selectKITOnFELSPage(response) {
        console.log(`selecting KIT on ${response.url}`);

        let doc = await parseResponseToDoc(response);
        let formData = this.fillFELSSelectionForm(doc, FELSAuthenticator.FELS_FORM_SELECT_KIT);
        const selectResponse = await fetch(response.url, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const sendFormData = this.fillFELSSelectionForm(doc, FELSAuthenticator.FELS_FORM_SEND_KIT);

        return await fetch(selectResponse.url, {
            method: 'POST',
            body: sendFormData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    }

    fillFELSSelectionForm(doc, defaults) {
        let formData = new URLSearchParams();

        for (let fieldName in defaults) {
            formData.append(fieldName, defaults[fieldName]);
        }

        let viewState = doc.querySelector(`input[name="${FELSAuthenticator.VIEWSTATE_FIELD}"]`);
        formData.append(FELSAuthenticator.VIEWSTATE_FIELD, viewState.value);

        return formData;
    }
}

async function parseResponseToDoc(response) {
    return domParser.parseFromString(await response.text(), 'text/html');
}

function getInputField(doc, name) {
    return doc.querySelector(`input[name=${name}]`);
}

function getAuthenticator(type, pageId) {
    switch (type) {
        case 'oidc':
            return new OIDCAuthenticator(type, pageId);
        case 'fels':
            return new FELSAuthenticator(type, pageId);
        case 'default':
        default:
            return new DefaultAuthenticator(type, pageId);
    }
}

module.exports = {
    getAuthenticator
}