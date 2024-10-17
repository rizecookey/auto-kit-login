const browser = require('webextension-polyfill');
const { getConfig } = require('../config');
const { InvalidLoginError } = require('../error_types');

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
        let moddedUrl = new URL(pageUrl);
        console.log("opening login popup");
        let popup = await browser.windows.create({ type: 'popup', height: 600, width: 500, url: moddedUrl.toString() });
        console.log("waiting for authentication");

        return await this.waitForAuthentication(popup);
    }

    waitForAuthentication(popup) {
        let authenticator = this;
        return new Promise((resolve, reject) => {
            function onNavigateInPopup(details) {
                let originalHostname = getConfig().pages[authenticator.#pageId].hostname;
                let currentHostname = new URL(details.url).hostname;
                if (details.windowId == popup.id && originalHostname === currentHostname) {
                    console.log("window seems to have completed authentication");
                    browser.webNavigation.onBeforeNavigate.removeListener(onNavigateInPopup);
                    browser.windows.onRemoved.removeListener(onWindowClosed);
                    browser.windows.remove(popup.id);
                    resolve(true);
                }
            }

            function onWindowClosed(windowId) {
                if (windowId === popup.id) {
                    browser.webNavigation.onBeforeNavigate.removeListener(onNavigateInPopup);
                    browser.windows.onRemoved.removeListener(onWindowClosed);
                    reject(new Error("login window was closed without successfull authentication"));
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