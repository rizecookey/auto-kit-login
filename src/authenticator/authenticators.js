const browser = require('webextension-polyfill');
const { getConfig } = require('../common/config');
const { getLoginDetector } = require('../common/login_detectors');

class DefaultAuthenticator {
    #name;
    #pageId;

    constructor(name, pageId) {
        this.#name = name;
        this.#pageId = pageId;
    }

    getName() {
        return this.#name;
    }

    getPageId() {
        return this.#pageId;
    }

    async authenticate(pageUrl) {
        console.log("opening login popup");
        let popup = await browser.windows.create({ type: 'popup', height: 600, width: 500, url: pageUrl });
        console.log("waiting for authentication");

        return await this.waitForAuthentication(popup);
    }

    waitForAuthentication(popup) {
        let authenticator = this;
        let isLoggedIn = false;
        return new Promise((resolve, reject) => {
            async function onNavigateInPopup(details) {
                if (details.windowId != popup.id) {
                    return;
                }

                let pageConfig = getConfig().pages[authenticator.#pageId];
                let loginDetectorConfig = pageConfig.loginDetector;
                let loginDetector = getLoginDetector(loginDetectorConfig);
                if (!(await loginDetector.isLoggedIn(pageConfig.hostname))) {
                    return;
                }

                console.log("window seems to have completed authentication");
                isLoggedIn = true;
                browser.windows.remove(popup.id);
                resolve(true);
            }

            async function onWindowClosed(windowId) {
                if (windowId != popup.id) {
                    return;
                }

                console.log("popup closed, removing listeners");
                browser.webNavigation.onBeforeNavigate.removeListener(onNavigateInPopup);
                browser.windows.onRemoved.removeListener(onWindowClosed);
                
                if (!isLoggedIn) {
                    reject(new Error("login window was closed without successful authentication"));
                }
            }

            browser.webNavigation.onCommitted.addListener(onNavigateInPopup);
            browser.windows.onRemoved.addListener(onWindowClosed)
        });
    }
}

function getAuthenticator(type, pageId) {
    return new DefaultAuthenticator(type, pageId);
}

module.exports = {
    getAuthenticator
}