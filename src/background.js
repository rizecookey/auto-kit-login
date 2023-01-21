chrome.webNavigation.onBeforeNavigate.addListener((details) => {
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
        hostContains: 'ilias.studium.kit.edu'
    }]
});

async function makeLoginRequest(tabId) {
    chrome.tabs.update(tabId, {
        url: "authenticating.html"
    });
    console.log("starting authentication on tab with id " + tabId);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.tab == authenticationTab && request.closeTab) {
        console.log(`closing authentication tab with id ${authenticationTab.id}`);
        chrome.tabs.remove({ tabIds: authenticationTab.id });
    }
})