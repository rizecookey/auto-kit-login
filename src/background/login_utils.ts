import browser, { WebRequest } from 'webextension-polyfill';
import { config } from '../common/config';
import userConfigManager from '../common/user_config';
import { storage } from '../common/storage';

const logoutUrlFilter = config.filters.logout;

type AuthenticationPausedMap = { [key: number]: string[] };
const authenticationPausedMap = storage<AuthenticationPausedMap>('authenticationPausedMap', browser.storage.session, {});

async function isAuthenticationPaused(tabId: number, pageDetailsId: string): Promise<boolean> {
    const authenticationPausedPages = (await authenticationPausedMap.get())[tabId] || [];
    return authenticationPausedPages.includes(pageDetailsId);
}

async function setAuthenticationPaused(tabId: number, pageDetailsId: string, value: boolean): Promise<void> {
    await authenticationPausedMap.with(authenticationPausedMap => {
        let pausedIds = authenticationPausedMap[tabId] || [];
        if (value && !pausedIds.includes(pageDetailsId)) {
            pausedIds.push(pageDetailsId);
        } else if (!value && pausedIds.includes(pageDetailsId)) {
            pausedIds = pausedIds.filter(element => element == pageDetailsId);
        }

        if (pausedIds.length == 0) {
            delete authenticationPausedMap[tabId];
        } else {
            authenticationPausedMap[tabId] = pausedIds;
        }
        return authenticationPausedMap;
    });
}

async function clearPausedSites(tabId: number): Promise<void> {
    await authenticationPausedMap.with(authenticationPausedMap => { delete authenticationPausedMap[tabId] });
}

async function shouldAutoLogin(tabId: number, pageId: string): Promise<boolean> {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !(await isAuthenticationPaused(tabId, pageId));
}

async function onVisitLogoutPage(details: WebRequest.OnResponseStartedDetailsType): Promise<void> {
    await authenticationPausedMap.set({});
}

browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
    urls: [logoutUrlFilter]
});
browser.tabs.onRemoved.addListener((tabId, _) => clearPausedSites(tabId));

export default { setAuthenticationPaused, clearPausedSites, shouldAutoLogin }