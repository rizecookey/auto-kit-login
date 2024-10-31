import browser, { WebRequest } from 'webextension-polyfill';
import { config } from '../config';
import userConfigManager from '../user_config';
import { storage } from '../storage';
import { bridged } from '../bridge/bridge';

const bridgedFuncs: ((params: any) => any)[] = [];

const logoutUrlFilter = config.filters.logout;

type AuthenticationPausedMap = { [key: number]: string[] };
const authenticationPausedMap = storage<AuthenticationPausedMap>('authenticationPausedMap', browser.storage.session, {});

const isAuthenticationPaused = bridged(bridgedFuncs, 'background', 'isAuthenticationPaused', async function([tabId, pageDetailsId]: [number, string]): Promise<boolean> {
    const authenticationPausedPages = (await authenticationPausedMap.get())[tabId] || [];
    return authenticationPausedPages.includes(pageDetailsId);
});

const setAuthenticationPaused = bridged(bridgedFuncs, 'background', 'setAuthenticationPaused', async function([tabId, pageDetailsIds, value]: [number, string | string[], boolean]): Promise<void> {
    let newPaused = [pageDetailsIds].flat(1);
    await authenticationPausedMap.with(authenticationPausedMap => {
        let pausedIds = authenticationPausedMap[tabId] || [];
        for (let pageDetailsId of newPaused) {
            if (value && !pausedIds.includes(pageDetailsId)) {
                pausedIds.push(pageDetailsId);
            } else if (!value && pausedIds.includes(pageDetailsId)) {
                pausedIds = pausedIds.filter(element => element == pageDetailsId);
            }
        }

        if (pausedIds.length == 0) {
            delete authenticationPausedMap[tabId];
        } else {
            authenticationPausedMap[tabId] = pausedIds;
        }
        return authenticationPausedMap;
    });
});

const clearPausedSites = bridged(bridgedFuncs, 'background', 'clearPausedSites', async function(tabId: number): Promise<void> {
    await authenticationPausedMap.with(authenticationPausedMap => { delete authenticationPausedMap[tabId] });
});

const shouldAutoLogin = bridged(bridgedFuncs, 'background', 'shouldAutoLogin', async function([tabId, pageId]: [number, string]): Promise<boolean> {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !(await isAuthenticationPaused([tabId, pageId]));
});

async function onVisitLogoutPage(details: WebRequest.OnResponseStartedDetailsType): Promise<void> {
    await authenticationPausedMap.set({});
}

function bridge() {
    browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
        urls: [logoutUrlFilter]
    });
    browser.tabs.onRemoved.addListener((tabId, _) => clearPausedSites(tabId));

    return bridgedFuncs;
}

export default { bridge, setAuthenticationPaused, clearPausedSites, shouldAutoLogin }