const browser = require('webextension-polyfill');
const { getConfig } = require('../common/config');
const { getLoginDetector } = require('../common/login_detectors');

const domParser = new DOMParser();

const loginFormPostHeaders = {
    postHeaders: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
}

class DefaultAuthenticator {
    #name;
    #pageId;

    constructor(name, pageId) {
        this.#name = name;
        this.#pageId = pageId;
    }

    getName() {
        return this.#name;
    }

    getPageId() {
        return this.#pageId;
    }

    async authenticate(pageUrl) {
        console.log("opening login popup");
        let popup = await browser.windows.create({ type: 'popup', height: 600, width: 500, url: pageUrl });
        console.log("waiting for authentication");

        return await this.waitForAuthentication(popup);
    }

    waitForAuthentication(popup) {
        let authenticator = this;
        let isLoggedIn = false;
        return new Promise((resolve, reject) => {
            async function onNavigateInPopup(details) {
                let windowId = (await browser.tabs.get(details.tabId)).windowId;
                if (windowId != popup.id) {
                    return;
                }

                let pageConfig = getConfig().pages[authenticator.#pageId];
                let loginDetectorConfig = pageConfig.loginDetector;
                let loginDetector = getLoginDetector(loginDetectorConfig);
                if (!(await loginDetector.isLoggedIn(pageConfig.hostname))) {
                    return;
                }

                console.log("window seems to have completed authentication");
                isLoggedIn = true;
                browser.windows.remove(popup.id);
                resolve(true);
            }

            async function onWindowClosed(windowId) {
                if (windowId != popup.id) {
                    return;
                }

                console.log("popup closed, removing listeners");
                browser.webNavigation.onBeforeNavigate.removeListener(onNavigateInPopup);
                browser.windows.onRemoved.removeListener(onWindowClosed);
                
                if (!isLoggedIn) {
                    reject(new Error("login window was closed without successful authentication"));
                }
            }

            browser.webNavigation.onCommitted.addListener(onNavigateInPopup);
            browser.windows.onRemoved.addListener(onWindowClosed)
        });
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

    async authenticate(pageUrl) {
        let signInPageResponse = await this.initiateAuthentication(pageUrl);
        if (signInPageResponse.ok && new URL(signInPageResponse.url).hostname != new URL(FELSAuthenticator.LOGIN_PAGE).hostname) {
            return signInPageResponse;
        }

        await this.selectKITOnFELSPage(signInPageResponse);
        
        return await super.authenticate(FELSAuthenticator.LOGIN_PAGE);
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
}

async function parseResponseToDoc(response) {
    return domParser.parseFromString(await response.text(), 'text/html');
}

function getAuthenticator(type, pageId) {
    switch (type) {
        case 'fels':
            return new FELSAuthenticator(type, pageId);
        default:
            return new DefaultAuthenticator(type, pageId);
    }
}

module.exports = {
    getAuthenticator
}