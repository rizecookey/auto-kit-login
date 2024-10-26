import browser, { WebNavigation } from 'webextension-polyfill'
import loginUtils from './login_utils'
import { getLoginDetector } from '../common/login_detectors';
import { config, getAutologinPageFilters, PageConfig } from '../common/config';
import { isSpecialTab, isSpecialWindow } from '../common/bridged/special_tabs';

// stupid chrome prerendering
type NavigationDetails = WebNavigation.OnBeforeNavigateDetailsType & { documentLifecycle?: string };

const AUTHENTICATION_EXT_PAGE = "authenticator/authenticating.html";

const idpUrl = config.idpUrl;
const autologinPageFilters = getAutologinPageFilters();
const pageParameters = config.extension.pageParameters;

async function onVisitAuthenticatablePage(details: NavigationDetails) {
    if (details.documentLifecycle == 'prerender') {
        return;
    }

    let tab = await browser.tabs.get(details.tabId);
    if (await isSpecialTab(details.tabId)) {
        return;
    }

    if (browser.windows !== undefined && tab.windowId !== undefined && await isSpecialWindow(tab.windowId)) {
        return;
    }

    let url = new URL(details.url);
    let domain = url.hostname;
    let pageDetailsId = findMatchingPageDetailsId(domain);
    if (pageDetailsId === undefined) {
        return;
    }
    if (!pageDetailsId || !await loginUtils.shouldAutoLogin(details.tabId, pageDetailsId)) {
        return;
    }
    let pageDetails = config.pages[pageDetailsId];

    if (!await isLoggedIn(domain, pageDetails)) {
        await clearPreviousCookies();
        await redirectAndAuthenticate(details.tabId, pageDetailsId, new URL(details.url));
    }
}

function findMatchingPageDetailsId(domain: string): string | undefined {
    let pageIdFound: string | undefined;

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        if (domain.includes(page.hostname)) {
            pageIdFound = pageId;
        }
    }

    return pageIdFound;
}

async function isLoggedIn(domain: string, pageDetails: PageConfig): Promise<boolean> {
    let loginDetectorConfig = pageDetails.loginDetector;
    let loginDetector = getLoginDetector(loginDetectorConfig);

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
        url: `${AUTHENTICATION_EXT_PAGE}?${params.toString()}`
    });
    console.log('starting authentication on tab ' + tabId);
}

async function onAuthRequest(sender: browser.Runtime.MessageSender, data: any): Promise<void> {
    if (data.redirect) {
        if (sender.tab?.id === undefined) {
            return;
        }
        await runAuthRedirect(sender.tab.id, data.redirect, data.pageDetailsId);
        return;
    }

    if (data.error) {
        await onAuthError(data.error);
    }
}

async function onAuthError(error: Error) {
    console.log(`authenticator tab reported error: ${error.message}`);
}

async function runAuthRedirect(tabId: number, authRedirectData: any, pageDetailsId: string) {
    console.log(`redirecting auth tab back to '${authRedirectData.url}'`);

    loginUtils.setAuthenticationPaused(tabId, pageDetailsId, true);

    await browser.tabs.update(tabId, {
        url: authRedirectData.url
    });
}

function registerListeners() {
    // ensure visit listeners are always fully executed one after another
    let activeVisitListenersPerTab = new Map();
    browser.webNavigation.onBeforeNavigate.addListener(details => {
        let activePromise = activeVisitListenersPerTab.get(details.tabId) || Promise.resolve();
        activeVisitListenersPerTab.set(details.tabId, activePromise.then(() => onVisitAuthenticatablePage(details)));
    }, { url: autologinPageFilters });
    browser.tabs.onRemoved.addListener(tabId => activeVisitListenersPerTab.delete(tabId));

    browser.runtime.onMessage.addListener((request: any, sender, _) => {
        if (request.auth) {
            onAuthRequest(sender, request.auth);
        }
        return undefined;
    });
}

export default { registerListeners }