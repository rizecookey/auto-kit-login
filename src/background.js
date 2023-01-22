const Constants = require('./constants');

let preventRedirection = false;

chrome.webNavigation.onCompleted.addListener(() => {
    if (preventRedirection) {
        preventRedirection = false;
    }
}, {
    url: filters()
})

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (preventRedirection) {
        return;
    }
    let cookies = await chrome.cookies.getAll({
        domain: new URL(details.url).hostname
    });
    let sessionCookie = cookies.find(cookie => cookie.name.startsWith('_shibsession'));
    if (!sessionCookie) {
        await clearIDPSessionCookie();
        await redirectAndAuthenticate(details.tabId, details.url);
    }
}, {
    url: filters()
});

function filters() {
    let filters = [];
    for (let elem of Constants.LOGIN_PAGES.keys()) {
        filters.push({
            hostContains: elem
        });
    }

    return filters;
}

async function redirectAndAuthenticate(tabId, loginPage, originalPage) {
    let params = new URLSearchParams();
    params.append(Constants.Param.LOGIN_URL, loginPage);
    params.append(Constants.Param.REDIRECT, originalPage);
    chrome.tabs.update(tabId, {
        url: `authenticating.html?${params.toString()}`
    });
    console.log('starting authentication on tab with id ' + tabId);
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

chrome.runtime.onMessage.addListener(async (request, sender) => {
    if (request.authRedirect) {
        console.log('redirecting auth tab back to ' + request.authRedirect);

        preventRedirection = true;
        await chrome.tabs.update(sender.tab.id, {
            url: request.authRedirect
        });
    }
})