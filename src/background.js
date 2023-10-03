let browser = require('webextension-polyfill');

const configLoader = require('./config');
const config = configLoader.getConfig();
const autologinPageFilters = configLoader.getAutologinPageFilters();
const { getAuthenticator } = require('./authenticators');

const pageParameters = config.extension.pageParameters;

let preventAutologin = false;
console.log('background script initialized')
registerListeners();

async function isLoginSaved() {
    let loginDetails = (await browser.storage.local.get('loginDetails')).loginDetails;
    return loginDetails?.username && loginDetails.password;
}

async function clearPreviousCookies() {
    let cookies = await browser.cookies.getAll({
        url: config.loginSequence.url.idp
    });
    for (let cookie of cookies) {
        await browser.cookies.remove({
            name: cookie.name,
            url: config.loginSequence.url.idp
        });
    }
}

async function onVisitLoginPage(details) {
    if (!await isLoginSaved()) {
        await injectCredentialGrabber(details.tabId);
    }
}

async function onVisitLogoutPage(details) {
    if (await isLoginSaved()) {
        await deleteCredentials();
    }
}

function findMatchingPageDetails(domain) {
    let pageDetails;

    for (let page of config.pages) {
        if (domain.includes(page.hostname)) {
            pageDetails = page;
        }
    }

    return pageDetails;
}

async function onVisitAuthenticatablePage(details) {
    if (preventAutologin || !await isLoginSaved()) {
        return;
    }

    let domain = new URL(details.url).hostname;
    let pageDetails = findMatchingPageDetails(domain);

    if (!pageDetails) {
        return;
    }

    let cookies = await browser.cookies.getAll({
        domain: domain
    });
    let authenticator = getAuthenticator(pageDetails.authenticator);
    if (!authenticator.isLoggedIn(cookies)) {
        await clearPreviousCookies();
        await redirectAndAuthenticate(details.tabId, pageDetails, details.url);
    }
}

async function redirectAndAuthenticate(tabId, pageDetails, originalPage) {
    let params = new URLSearchParams();
    params.append(pageParameters.loginUrl, pageDetails.loginPage);
    params.append(pageParameters.redirect, originalPage);
    params.append(pageParameters.authenticatorType, pageDetails.authenticator)
    browser.tabs.update(tabId, {
        url: `authenticating.html?${params.toString()}`
    });
    console.log('starting authentication on tab ' + tabId);
}

async function injectCredentialGrabber(tabId) {
    await browser.scripting.executeScript({
        target: { tabId: tabId },
        files: ["grab_login.js"]
    });
    preventAutologin = true;
}

async function deleteCredentials() {
    await browser.storage.local.remove('loginDetails');
    console.log('deleting login for currently logged in user');
    preventAutologin = false;
}

async function onGrabberRequest(sender, data) {
    if (data.initialized) {
        console.log(`KIT credential grabber has been initialized on tab ${sender.tab.id}`);
        return;
    }

    if (data.storedCredentials) {
        console.log(`stored login for user '${data.storedCredentials}'`);
    }
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
    console.log(error.stack);
    await deleteCredentials();
}

async function runAuthRedirect(tabId, authRedirectData) {
    console.log(`redirecting auth tab back to '${authRedirectData.url}'`);

    await browser.tabs.update(tabId, {
        url: authRedirectData.url
    });
    preventAutologin = true;
}

function registerListeners() {
    browser.webNavigation.onCommitted.addListener(() => {
        if (preventAutologin) {
            preventAutologin = false;
        }
    }, {
        url: autologinPageFilters
    });
    
    browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
        urls: [config.loginSequence.url.logout]
    });
    browser.webRequest.onResponseStarted.addListener(onVisitLoginPage, {
        urls: [config.loginSequence.url.login]
    });
    browser.webNavigation.onBeforeNavigate.addListener(onVisitAuthenticatablePage, {
        url: autologinPageFilters
    });
    
    browser.runtime.onMessage.addListener(async (request, sender) => {
        if (request.credentialGrabber) {
            await onGrabberRequest(sender, request.credentialGrabber);
            return;
        }
        if (request.auth) {
            await onAuthRequest(sender, request.auth);
        }
    });
}