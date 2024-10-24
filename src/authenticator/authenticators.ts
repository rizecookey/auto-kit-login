import browser from 'webextension-polyfill';
import { WebNavigation, Windows } from 'webextension-polyfill';
import { getConfig, AuthenticatorType } from '../common/config'
import { getLoginDetector } from '../common/login_detectors';

const domParser = new DOMParser();

const loginFormPostHeaders: HeadersInit = {
    'Content-Type': 'application/x-www-form-urlencoded'
}

interface Authenticator {
    getPageId(): string;
    authenticate(pageUrl: URL): Promise<void>;
}

class DefaultAuthenticator implements Authenticator {
    #pageId: string;

    constructor(pageId: string) {
        this.#pageId = pageId;
    }

    getPageId(): string {
        return this.#pageId;
    }

    async authenticate(pageUrl: URL): Promise<void> {
        console.log("opening login popup");
        let popup = await browser.windows.create({ type: 'popup', height: 600, width: 500, url: pageUrl.toString() });
        console.log("waiting for authentication");

        return await this.waitForAuthentication(popup);
    }

    waitForAuthentication(popup: Windows.Window): Promise<void> {
        let authenticator = this;
        let isLoggedIn = false;
        return new Promise<void>((resolve, reject) => {
            async function onNavigateInPopup(details: WebNavigation.OnCommittedDetailsType) {
                let windowId = (await browser.tabs.get(details.tabId)).windowId;
                if (popup.id == null || windowId != popup.id) {
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
                resolve();
            }

            async function onWindowClosed(windowId: number) {
                if (windowId != popup.id) {
                    return;
                }

                console.log("popup closed, removing listeners");
                browser.webNavigation.onCommitted.removeListener(onNavigateInPopup);
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

class FELSAuthenticator extends DefaultAuthenticator implements Authenticator {
    static LOGIN_PAGE: URL = new URL("https://fels.scc.kit.edu/Shibboleth.sso/Login");
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

    async authenticate(pageUrl: URL): Promise<void> {
        let signInPageResponse = await this.initiateAuthentication(pageUrl);
        if (signInPageResponse.ok && new URL(signInPageResponse.url).hostname != new URL(FELSAuthenticator.LOGIN_PAGE).hostname) {
            return;
        }

        await this.selectKITOnFELSPage(signInPageResponse);
        
        return await super.authenticate(FELSAuthenticator.LOGIN_PAGE);
    }

    async initiateAuthentication(pageUrl: URL): Promise<Response> {
        console.log(`loading login page from ${pageUrl}`);
        let pageLoadResponse = await fetch(pageUrl, {
            method: 'GET'
        });

        let document = await parseResponseToDoc(pageLoadResponse);

        return await this.autoSubmitForm(pageUrl, document);
    }

    async selectKITOnFELSPage(response: Response): Promise<Response> {
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

    fillFELSSelectionForm(doc: Document, defaults: {[key: string]: string}): URLSearchParams {
        let formData = new URLSearchParams();

        for (let fieldName in defaults) {
            formData.append(fieldName, defaults[fieldName]);
        }

        let viewState = doc.querySelector<HTMLInputElement>(`input[name="${FELSAuthenticator.VIEWSTATE_FIELD}"]`);
        if (!viewState) {
            throw new Error('could not find necessary viewstate field');
        }
        formData.append(FELSAuthenticator.VIEWSTATE_FIELD, viewState.value);

        return formData;
    }

    async autoSubmitForm(originalUrl: URL, doc: Document): Promise<Response> {
        let form = doc.forms[0];

        let formData = this.scrapePresetFormDetails(doc, 0);
        let responseURL = new URL(originalUrl);
        let url = new URL(form.getAttribute('action')!!, responseURL.origin + responseURL.pathname);

        console.log(`auto-submitting form from ${originalUrl} to ${url}`);
        return await fetch(url, {
            method: 'POST',
            headers: loginFormPostHeaders,
            body: formData
        });
    }

    scrapePresetFormDetails(doc: Document, formId: number): URLSearchParams {
        let formData = new URLSearchParams();

        let form = doc.forms[formId];
        let elementsCollection = form.getElementsByTagName('input');
        for (let i = 0; i < elementsCollection.length; i++) {
            let element = elementsCollection.item(i);
            if (element == null) {
                continue;
            }
            formData.append(element.name, element.value);
        }

        return formData;
    }
}

async function parseResponseToDoc(response: Response): Promise<Document> {
    return domParser.parseFromString(await response.text(), 'text/html');
}

function getAuthenticator(type: AuthenticatorType, pageId: string): Authenticator {
    switch (type) {
        case 'fels':
            return new FELSAuthenticator(pageId);
        default:
            return new DefaultAuthenticator(pageId);
    }
}

export { getAuthenticator }