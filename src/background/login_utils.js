import browser from 'webextension-polyfill';
import * as configLoader from '../common/config';
import * as userConfigManager from '../common/user_config';

const config = configLoader.getConfig();

const logoutUrlFilter = config.filters.logout;

let navigationIncomplete = false;
const authenticationPausedTabs = new Map();

function isAuthenticationPaused(tabId, pageDetailsId) {
    return authenticationPausedTabs.has(tabId) && authenticationPausedTabs.get(tabId).includes(pageDetailsId);
}

function setAuthenticationPaused(tabId, pageDetailsId, value) {
    let pausedIds = authenticationPausedTabs.get(tabId) || [];
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
    return userConfig.enabled && userConfig.autologinPages[pageId] && !navigationIncomplete && !isAuthenticationPaused(tabId, pageId);
}

async function onVisitLogoutPage(details) {
    authenticationPausedTabs.clear();
}

function setNavigationIncomplete(incomplete) {
    navigationIncomplete = incomplete;
}

browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
    urls: [logoutUrlFilter]
});
browser.tabs.onRemoved.addListener((tabId, _) => clearPausedSites(tabId));

export { setAuthenticationPaused, clearPausedSites, shouldAutoLogin, setNavigationIncomplete }