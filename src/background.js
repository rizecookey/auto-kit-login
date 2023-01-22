const ILIAS_HOST = 'ilias.studium.kit.edu';

var preventRedirection = false;

chrome.webNavigation.onCompleted.addListener(() => {
    if (preventRedirection) {
        preventRedirection = false;
    }
}, {
    url: [{
        hostContains: ILIAS_HOST
    }]
})

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (preventRedirection) {
        return;
    }
    chrome.cookies.getAll({
        domain: 'kit.edu'
    }, (cookies) => {
        let sessionCookie = cookies.find(cookie => cookie.name.startsWith('_shibsession'));
        if (!sessionCookie) {
            redirectAndAuthenticate(details.tabId, details.url);
        }
    });
}, {
    url: [{
        hostContains: ILIAS_HOST
    }]
});

async function redirectAndAuthenticate(tabId, originalPage) {
    chrome.tabs.update(tabId, {
        url: `authenticating.html?redirect_to=${encodeURIComponent(originalPage)}`
    });
    console.log('starting authentication on tab with id ' + tabId);
}

chrome.runtime.onMessage.addListener(async (request, sender) => {
    if (request.auth_redirect) {
        console.log('redirecting auth tab back to ' + request.auth_redirect);

        preventRedirection = true;
        await chrome.tabs.update(sender.tab.id, {
            url: request.auth_redirect
        });
    }
})