let browser = require('webextension-polyfill');

const configLoader = require('./config');
const config = configLoader.getConfig();
const autologinPageFilters = configLoader.getAutologinPageFilters();

let preventAutologin = false;

console.log('background script initialized')
registerListeners();

async function isLoginSaved() {
    let loginDetails = (await browser.storage.local.get('loginDetails')).loginDetails;
    return loginDetails?.username && loginDetails.password;
}

async function clearIDPSessionCookie() {
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

async function onVisitAuthenticatablePage(details) {
    if (preventAutologin || !await isLoginSaved()) {
        return;
    }

    let domain = new URL(details.url).hostname;
    let cookies = await browser.cookies.getAll({
        domain: domain
    });
    let sessionCookie = cookies.find(cookie => 
        cookie.name.startsWith(config.loginSequence.cookies.shibsession));
    if (!sessionCookie) {
        await clearIDPSessionCookie();
        let loginUrl;
        for (let page of config.pages) {
            if (domain.includes(page.hostname)) {
                loginUrl = page.loginPage;
                break;
            }
        }
        if (!loginUrl) {
            return;
        }
        await redirectAndAuthenticate(details.tabId, loginUrl, details.url);
    }
}

async function redirectAndAuthenticate(tabId, loginPage, originalPage) {
    let params = new URLSearchParams();
    params.append(config.extension.pageParameters.loginUrl, loginPage);
    params.append(config.extension.pageParameters.redirect, originalPage);
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
    console.log(`authenticator tab reported error: '${error.message}'`);
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