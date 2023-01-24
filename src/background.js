let browser = require('webextension-polyfill');

const config = require('./config');

let preventRedirection = false;

browser.webNavigation.onCompleted.addListener(() => {
    if (preventRedirection) {
        preventRedirection = false;
    }
}, {
    url: kitPageFilters()
});

browser.webRequest.onCompleted.addListener(async () => {
    if (await loginSaved()) {
        await deleteCredentials();
    }
}, {
    urls: [config.loginSequence.url.logout]
});

browser.webRequest.onCompleted.addListener(async (details) => {
    if (!await loginSaved()) {
        await injectCredentialGrabber(details.tabId);
    }
}, {
    urls: [config.loginSequence.url.login]
});

browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (preventRedirection) {
        return;
    }
    if (!await loginSaved()) {
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
        let loginUrl = undefined;
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
}, {
    url: kitPageFilters()
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

async function loginSaved() {
    let loginDetails = (await browser.storage.local.get('loginDetails')).loginDetails;
    return loginDetails && loginDetails.username && loginDetails.password;
}

function kitPageFilters() {
    let filters = [];
    for (let page of config.pages) {
        filters.push({
            hostContains: page.hostname
        });
    }

    return filters;
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
    console.log('injecting credential grabber on tab ' + tabId);
    await browser.scripting.executeScript({
        target: { tabId: tabId },
        files: ["grab_login.js"]
    });
    preventRedirection = true;
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

    preventRedirection = true;
    await browser.tabs.update(tabId, {
        url: authRedirectData.url
    });
}