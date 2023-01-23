const Constants = require('./constants');

let preventRedirection = false;

chrome.webNavigation.onCompleted.addListener(() => {
    if (preventRedirection) {
        preventRedirection = false;
    }
}, {
    url: kitPageFilters()
});

chrome.webRequest.onCompleted.addListener(async () => {
    if (await loginSaved()) {
        await deleteCredentials();
    }
}, {
    urls: [Constants.LOGOUT_URL]
});

chrome.webRequest.onCompleted.addListener(async (details) => {
    if (!await loginSaved()) {
        await injectCredentialGrabber(details.tabId);
    }
}, {
    urls: [Constants.LOGIN_URL]
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (preventRedirection) {
        return;
    }
    if (!await loginSaved()) {
        return;
    }
    let domain = new URL(details.url).hostname;
    let cookies = await chrome.cookies.getAll({
        domain: domain
    });
    let sessionCookie = cookies.find(cookie => cookie.name.startsWith(Constants.SHIBSESSION_COOKIE));
    if (!sessionCookie) {
        await clearIDPSessionCookie();
        let loginUrl = undefined;
        for (let hostname of Constants.LOGIN_PAGES.keys()) {
            if (domain.includes(hostname)) {
                loginUrl = Constants.LOGIN_PAGES.get(hostname);
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

chrome.runtime.onMessage.addListener(async (request, sender) => {
    if (request.credentialGrabber) {
        await onGrabberRequest(sender, request.credentialGrabber);
        return;
    }
    if (request.auth) {
        await onAuthRequest(sender, request.auth);
    }
});

async function loginSaved() {
    let loginDetails = (await chrome.storage.local.get(Constants.LOGIN_DETAILS_KEY))[Constants.LOGIN_DETAILS_KEY];
    return loginDetails && loginDetails.username && loginDetails.password;
}

function kitPageFilters() {
    let filters = [];
    for (let elem of Constants.LOGIN_PAGES.keys()) {
        filters.push({
            hostContains: elem
        });
    }

    return filters;
}

async function clearIDPSessionCookie() {
    let cookies = await chrome.cookies.getAll({
        url: Constants.IDP_URL
    });
    for (let cookie of cookies) {
        await chrome.cookies.remove({
            name: cookie.name,
            url: Constants.IDP_URL
        });
    }
}

async function redirectAndAuthenticate(tabId, loginPage, originalPage) {
    let params = new URLSearchParams();
    params.append(Constants.Param.LOGIN_URL, loginPage);
    params.append(Constants.Param.REDIRECT, originalPage);
    chrome.tabs.update(tabId, {
        url: `authenticating.html?${params.toString()}`
    });
    console.log('starting authentication on tab ' + tabId);
}

async function injectCredentialGrabber(tabId) {
    console.log('injecting credential grabber on tab ' + tabId);
    await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["grab_login.js"]
    });
    preventRedirection = true;
}

async function deleteCredentials() {
    await chrome.storage.local.remove(Constants.LOGIN_DETAILS_KEY);
    console.log('deleting login for currently logged in user because they manually signed out');
}

async function onGrabberRequest(sender, data) {
    if (data.initialized) {
        console.log(`KIT credential grabber has been initialized on tab ${sender.tab.id}`);
        return;
    }

    if (data.storedCredentials) {
        console.log(`stored login for user '${data.storedCredentials.username}'`);
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
    //TODO
}

async function runAuthRedirect(tabId, authRedirectData) {
    console.log(`redirecting auth tab back to '${authRedirectData.url}'`);

    preventRedirection = true;
    await chrome.tabs.update(tabId, {
        url: authRedirectData.url
    });
}