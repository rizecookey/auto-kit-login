import browser from 'webextension-polyfill';
import { WebRequest } from 'webextension-polyfill';
import * as configLoader from '../common/config';
import * as userConfigManager from '../common/user_config';

const config = configLoader.getConfig();

const logoutUrlFilter = config.filters.logout;

const authenticationPausedTabs = new Map<number, string[]>();

function isAuthenticationPaused(tabId: number, pageDetailsId: string): boolean {
    return authenticationPausedTabs.has(tabId) && authenticationPausedTabs.get(tabId)?.includes(pageDetailsId) || false;
}

function setAuthenticationPaused(tabId: number, pageDetailsId: string, value: boolean): void {
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

function clearPausedSites(tabId: number): void {
    authenticationPausedTabs.delete(tabId);
}

async function shouldAutoLogin(tabId: number, pageId: string): Promise<boolean> {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !isAuthenticationPaused(tabId, pageId);
}

async function onVisitLogoutPage(details: WebRequest.OnResponseStartedDetailsType): Promise<void> {
    authenticationPausedTabs.clear();
}

browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
    urls: [logoutUrlFilter]
});
browser.tabs.onRemoved.addListener((tabId, _) => clearPausedSites(tabId));

export { setAuthenticationPaused, clearPausedSites, shouldAutoLogin }