import browser, { WebNavigation } from 'webextension-polyfill'
import loginUtils from '../common/bridged/login_utils'
import { getLoginDetector } from '../common/login_detectors';
import { config, findPageDetailsForDomain, getAutologinPageFilters, PageConfig } from '../common/config';
import { isSpecialTab, isSpecialWindow } from '../common/bridged/special_tabs';

// stupid chrome prerendering
type NavigationDetails = WebNavigation.OnBeforeNavigateDetailsType & { documentLifecycle?: string };

const idpUrl = config.idpUrl;
const autologinPageFilters = getAutologinPageFilters();
const pageParameters = config.extension.pageParameters;

async function onVisitAuthenticatablePage(details: NavigationDetails): Promise<boolean> {
    if (details.documentLifecycle == 'prerender') {
        return false;
    }

    let tab = await browser.tabs.get(details.tabId);
    if (await isSpecialTab(details.tabId)) {
        return false;
    }

    if (browser.windows !== undefined && tab.windowId !== undefined && await isSpecialWindow(tab.windowId)) {
        return false;
    }

    let url = new URL(details.url);
    let domain = url.hostname;
    let [pageDetailsId, pageDetails] = findPageDetailsForDomain(domain);
    if (pageDetailsId === undefined || pageDetails === undefined || !await loginUtils.shouldAutoLogin([details.tabId, pageDetailsId])) {
        return false;
    }

    if (!await isLoggedIn(domain, pageDetailsId, pageDetails)) {
        await clearPreviousCookies();
        await redirectAndAuthenticate(details.tabId, pageDetailsId, new URL(details.url));
        return true;
    }
    return false;
}

async function injectSessionTimeoutDetectors(details: WebNavigation.OnDOMContentLoadedDetailsType) {
    const [pageId, pageDetails] = findPageDetailsForDomain(new URL(details.url).hostname);
    if (pageId === undefined || pageDetails == undefined || !await loginUtils.shouldAutoLogin([details.tabId, pageId]) || !pageDetails.sessionTimeoutDetectors) {
        return;
    }

    browser.scripting.executeScript({
        files: pageDetails.sessionTimeoutDetectors.map(file => `${config.extension.sessionTimeoutDetectorsDir}/${file}.js`),
        target: { tabId: details.tabId }
    });
}

async function isLoggedIn(domain: string, pageId: string, pageDetails: PageConfig): Promise<boolean> {
    let loginDetectorConfig = pageDetails.loginDetector;
    let loginDetector = getLoginDetector(pageId, loginDetectorConfig);

    return await loginDetector.isLoggedIn(domain);
}

async function clearPreviousCookies(): Promise<void> {
    let cookies = await browser.cookies.getAll({
        url: idpUrl
    });
    for (let cookie of cookies) {
        await browser.cookies.remove({
            name: cookie.name,
            url: idpUrl
        });
    }
}

async function redirectAndAuthenticate(tabId: number, pageDetailsId: string, originalPage: URL): Promise<void> {
    let params = new URLSearchParams();
    params.append(pageParameters.redirect, originalPage.toString());
    params.append(pageParameters.pageDetailsId, pageDetailsId)
    browser.tabs.update(tabId, {
        url: `${config.extension.authenticationPage}?${params.toString()}`
    });
    console.log('starting authentication on tab ' + tabId);
}

async function onAuthRequest(sender: browser.Runtime.MessageSender, data: any): Promise<void> {
    if (data.error) {
        await onAuthError(sender, data.error);
    }
    if (data.success) {
        await onAuthSuccess(sender);
    }
}

async function onAuthError(sender: browser.Runtime.MessageSender, error: Error) {
    console.log(`authenticator tab ${sender.tab?.id} reported error: ${error.message}`);
}

async function onAuthSuccess(sender: browser.Runtime.MessageSender) {
    console.log(`authenticator tab ${sender.tab?.id} completed successfully`);
}

async function onSessionTimeoutDetectorRequest(data: any, sender: browser.Runtime.MessageSender) {
    if (data.redirect) {
        await browser.tabs.update(sender.tab?.id, {
            url: data.redirect,
        });
    }
}

function registerListeners() {
    // ensure visit listeners are always fully executed one after another
    let tabNavigationListeners = new Map<number, Promise<boolean>>();
    browser.webNavigation.onBeforeNavigate.addListener(details => {
        let activePromise = tabNavigationListeners.get(details.tabId) || Promise.resolve(false);
        tabNavigationListeners.set(details.tabId, activePromise.then(async shortCircuit => {
            if (shortCircuit) {
                return true;
            }
            let newResult = await onVisitAuthenticatablePage(details);
            if (newResult) {
                tabNavigationListeners.delete(details.tabId);
            }
            return newResult;
        }));
    }, autologinPageFilters);
    browser.webNavigation.onDOMContentLoaded.addListener(details => injectSessionTimeoutDetectors(details), autologinPageFilters);
    browser.tabs.onRemoved.addListener(tabId => tabNavigationListeners.delete(tabId));

    browser.runtime.onMessage.addListener((request: any, sender, _) => {
        if (request.auth) {
            onAuthRequest(sender, request.auth);
        }
        if (request.sessionTimeoutDetector) {
            onSessionTimeoutDetectorRequest(request.sessionTimeoutDetector, sender);
        }
        return undefined;
    });
}

export default { registerListeners }