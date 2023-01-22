const ILIAS_HOST = 'ilias.studium.kit.edu';

var preventRedirection = false;

chrome.webNavigation.onCompleted.addListener((details) => {
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
            makeLoginRequest(details.tabId);
        }
    });
}, {
    url: [{
        hostContains: ILIAS_HOST
    }]
});

async function makeLoginRequest(tabId) {
    chrome.tabs.update(tabId, {
        url: 'authenticating.html'
    });
    console.log('starting authentication on tab with id ' + tabId);
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.auth_redirect) {
        console.log('redirecting auth tab back to ' + request.auth_redirect);

        preventRedirection = true;
        await chrome.tabs.update(sender.tab.id, {
            url: request.auth_redirect
        });
    }
})