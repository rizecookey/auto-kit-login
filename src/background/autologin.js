const browser = require('webextension-polyfill');
const loginUtils = require('./login_utils')
const { getLoginDetector } = require('./login_detectors');
const configLoader = require('../config');

const config = configLoader.getConfig();
const idpUrl = config.idpUrl;
const autologinPageFilters = configLoader.getAutologinPageFilters();

const pageParameters = config.extension.pageParameters;

async function onVisitAuthenticatablePage(details) {
    let domain = new URL(details.url).hostname;
    let pageDetailsId = findMatchingPageDetailsId(domain);
    if (!pageDetailsId || !await loginUtils.shouldAutoLogin(details.tabId, pageDetailsId)) {
        return;
    }
    let pageDetails = config.pages[pageDetailsId];

    if (!await isLoggedIn(domain, pageDetails)) {
        await clearPreviousCookies();
        await redirectAndAuthenticate(details.tabId, pageDetailsId, details.url);
    }
}

function findMatchingPageDetailsId(domain) {
    let pageIdFound;

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        if (domain.includes(page.hostname)) {
            pageIdFound = pageId;
        }
    }

    return pageIdFound;
}

async function isLoggedIn(domain, pageDetails) {
    let loginDetectorConfig = pageDetails.loginDetector;
    let loginDetector = getLoginDetector(loginDetectorConfig);

    return await loginDetector.isLoggedIn(domain);
}

async function clearPreviousCookies() {
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

async function redirectAndAuthenticate(tabId, pageDetailsId, originalPage) {
    let params = new URLSearchParams();
    params.append(pageParameters.redirect, originalPage);
    params.append(pageParameters.pageDetailsId, pageDetailsId)
    browser.tabs.update(tabId, {
        url: `authenticator/authenticating.html?${params.toString()}`
    });
    console.log('starting authentication on tab ' + tabId);
}

async function onAuthRequest(sender, data) {
    if (data.redirect) {
        await runAuthRedirect(sender.tab.id, data.redirect, data.pageDetailsId);
        return;
    }

    if (data.error) {
        await onAuthError(data.error);
    }
}

async function onAuthError(error) {
    console.log(`authenticator tab reported error: ${error.message}`);

    if (error.deleteLogin) {
        await loginUtils.deleteCredentials();
    }
}

async function runAuthRedirect(tabId, authRedirectData, pageDetailsId) {
    console.log(`redirecting auth tab back to '${authRedirectData.url}'`);

    loginUtils.setAuthenticationPaused(tabId, pageDetailsId, true);

    await browser.tabs.update(tabId, {
        url: authRedirectData.url
    });
}

function registerListeners() {
    browser.webNavigation.onBeforeNavigate.addListener(onVisitAuthenticatablePage, {
        url: autologinPageFilters
    });

    browser.runtime.onMessage.addListener(async (request, sender) => {
        if (request.auth) {
            await onAuthRequest(sender, request.auth);
        }
    });
}

module.exports = { registerListeners }