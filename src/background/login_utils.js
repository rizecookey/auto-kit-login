const browser = require('webextension-polyfill');
const configLoader = require('../config');
const userConfigManager = require('../user_config');

const config = configLoader.getConfig();

const logoutUrlFilter = config.filters.logout;

let navigationIncomplete = false;
const authenticationPausedTabs = new Map();

function isAuthenticationPaused(tabId, pageDetailsId) {
    return authenticationPausedTabs.has(tabId) && authenticationPausedTabs.get(tabId).includes(pageDetailsId);
}

function setAuthenticationPaused(tabId, pageDetailsId, value) {
    const pausedIds = authenticationPausedTabs.get(tabId) || [];
    if (value && !pausedIds.includes(pageDetailsId)) {
        pausedIds.push(pageDetailsId);
    } else if (!value && pausedIds.includes(pageDetailsId)) {
        pausedIds = pausedIds.filter(element => element == pageDetailsId);
    }

    if (pausedIds.length == 0) {
        authenticationPausedTabs.delete(tabId);
    } else {
        authenticationPausedTabs.set(tabId, pausedIds);
    }
}

function clearPausedSites(tabId) {
    authenticationPausedTabs.delete(tabId);
}

async function shouldAutoLogin(tabId, pageId) {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !navigationIncomplete && await isLoginSaved() && !isAuthenticationPaused(tabId, pageId);
}
async function isLoginSaved() {
    let loginDetails = (await browser.storage.local.get('loginDetails')).loginDetails;
    return loginDetails?.username && loginDetails.password;
}

async function deleteCredentials() {
    await browser.storage.local.remove('loginDetails');
    console.log('deleting login for currently logged in user');
}

async function saveLogin(username, password) {
    await browser.storage.local.set({
        loginDetails: {
            username: username,
            password: password
        }
    });
}

async function onVisitLogoutPage(details) {
    if (await isLoginSaved()) {
        await deleteCredentials();
    }
    authenticationPausedTabs.clear();
}

function setNavigationIncomplete(incomplete) {
    navigationIncomplete = incomplete;
}

browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
    urls: [logoutUrlFilter]
});
browser.tabs.onRemoved.addListener((tabId, _) => loginUtils.clearPausedSites(tabId));

module.exports = { setAuthenticationPaused, clearPausedSites, isLoginSaved, deleteCredentials, saveLogin, shouldAutoLogin, setNavigationIncomplete }