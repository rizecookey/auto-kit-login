const browser = require('webextension-polyfill');
const loginUtils = require('./login_utils')

const configLoader = require('./config');
const config = configLoader.getConfig();
const idpUrl = config.idpUrl;
const autologinPageFilters = configLoader.getAutologinPageFilters();

const pageParameters = config.extension.pageParameters;

async function onVisitAuthenticatablePage(details) {
    if (!await loginUtils.shouldAutoLogin()) {
        return;
    }

    let domain = new URL(details.url).hostname;
    let pageDetailsId = findMatchingPageDetailsId(domain);
    if (!pageDetailsId) {
        return;
    }
    let pageDetails = config.pages[pageDetailsId];

    if (!await sessionCookiePresent(domain, pageDetails)) {
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

async function sessionCookiePresent(domain, pageDetails) {
    let authenticatorConfig = getAuthenticatorConfig(pageDetails);
    let needed = authenticatorConfig.cookies.session;

    let cookies = await browser.cookies.getAll({
        domain: domain
    });

    return cookies.find(element => element.name.startsWith(needed));
}

function getAuthenticatorConfig(pageDetails) {
    return {...config.authenticators[pageDetails.authenticator], ...(pageDetails?.override ? pageDetails.override : {})};
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
        url: `authenticating.html?${params.toString()}`
    });
    console.log('starting authentication on tab ' + tabId);
}

async function onAuthRequest(sender, data) {
    if (data.redirect) {
        await runAuthRedirect(sender.tab.id, data.redirect);
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

async function runAuthRedirect(tabId, authRedirectData) {
    console.log(`redirecting auth tab back to '${authRedirectData.url}'`);

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