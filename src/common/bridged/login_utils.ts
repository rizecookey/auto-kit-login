import browser from 'webextension-polyfill';
import { config } from '../config';
import userConfigManager from '../user_config';
import { storage } from '../storage';
import { bridged, BridgeEndpoint } from '../bridge/bridge';

const bridgedFuncs: ((params: any) => any)[] = [];

const logoutUrlFilter = config.filters.logout;

type AuthenticationPausedMap = { [key: number]: string[] };
const authenticationPausedMap = storage<AuthenticationPausedMap>('authenticationPausedMap', browser.storage.session, {});
const loggedInPages = storage<string[]>('loggedInPages', browser.storage.session, []);

const isAuthenticationPaused = bridged(bridgedFuncs, 'background', 'isAuthenticationPaused', async function ([tabId, pageDetailsId]: [number, string]): Promise<boolean> {
    const authenticationPausedPages = (await authenticationPausedMap.get())[tabId] || [];
    return authenticationPausedPages.includes(pageDetailsId);
});

const setAuthenticationPaused = bridged(bridgedFuncs, 'background', 'setAuthenticationPaused', async function ([tabId, pageDetailsIds, value]: [number, string | string[], boolean]): Promise<void> {
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

const clearPausedSites = bridged(bridgedFuncs, 'background', 'clearPausedSites', async function (tabId: number): Promise<void> {
    await authenticationPausedMap.with(authenticationPausedMap => { delete authenticationPausedMap[tabId] });
});

const isLoggedIn = bridged(bridgedFuncs, 'background', 'isLoggedIn', async function (pageId: string): Promise<boolean> {
    return (await loggedInPages.get()).includes(pageId);
});

const setLoggedIn = bridged(bridgedFuncs, 'background', 'setLoggedIn', async function ([pageId, loggedIn]: [string, boolean]): Promise<void> {
    return await loggedInPages.with(value => {
        if (loggedIn && !value.includes(pageId)) {
            value.push(pageId);
        } else if (!loggedIn) {
            value = value.filter(id => id !== pageId);
        }
        return value;
    });
})

const shouldAutoLogin = bridged(bridgedFuncs, 'background', 'shouldAutoLogin', async function ([tabId, pageId]: [number, string]): Promise<boolean> {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !await isLoggedIn(pageId) && !(await isAuthenticationPaused([tabId, pageId]));
});

function bridge(endpoint: BridgeEndpoint) {
    if (endpoint == 'background') {
        browser.webRequest.onCompleted.addListener(async _ => await loggedInPages.set([]), { urls: [logoutUrlFilter] });
        browser.tabs.onRemoved.addListener((tabId, _) => clearPausedSites(tabId));
    }

    return bridgedFuncs;
}

export default { bridge, setAuthenticationPaused, clearPausedSites, shouldAutoLogin, isLoggedIn, setLoggedIn }