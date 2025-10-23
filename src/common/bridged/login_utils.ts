import browser, { Cookies, cookies } from 'webextension-polyfill';
import { config, findPageDetailsForDomain, getLogoutUrlFilters } from '../config';
import userConfigManager from '../user_config';
import { storage } from '../storage';
import { bridged, BridgeEndpoint } from '../bridge/bridge';

const bridgedFuncs: ((params: any) => any)[] = [];

const logoutUrlFilter = config.filters.logout;

type AuthenticationPausedMap = { [key: number]: string[] };
const authenticationPausedMap = storage<AuthenticationPausedMap>('authenticationPausedMap', browser.storage.session, {});
const loggedInPages = storage<[string, number][]>('loggedInPages', browser.storage.session, []);

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
    return (await loggedInPages.get()).some(([id, _]) => pageId === id);
});

const getLastLoginTime = bridged(bridgedFuncs, 'background', 'getLastLoginTime', async function (pageId: string): Promise<number | undefined> {
    return ((await loggedInPages.get()).find(([id, _]) => id === pageId) || [undefined, undefined])[1];
});

const setLoggedIn = bridged(bridgedFuncs, 'background', 'setLoggedIn', async function ([pageId, loggedIn]: [string, boolean]): Promise<void> {
    return await loggedInPages.with(value => {
        if (loggedIn && !value.some(([id, _]) => id === pageId)) {
            value.push([pageId, Date.now()]);
        } else if (!loggedIn) {
            value = value.filter(([id, _]) => id !== pageId);
        }
        return value;
    });
});

const shouldAutoLogin = bridged(bridgedFuncs, 'background', 'shouldAutoLogin', async function ([tabId, pageId]: [number, string]): Promise<boolean> {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !(await isAuthenticationPaused([tabId, pageId]));
});

function bridge(endpoint: BridgeEndpoint) {
    if (endpoint == 'background') {
        browser.webRequest.onCompleted.addListener(async details => {
            await loggedInPages.set([]);
            await setAuthenticationPaused([details.tabId, Object.keys(config.pages), true]);
        }, { urls: [logoutUrlFilter] });
        browser.webRequest.onCompleted.addListener(async details => {
            const [pageId, pageDetails] = findPageDetailsForDomain(new URL(details.url).hostname);
            if (pageId === undefined || pageDetails === undefined
                || pageDetails.logoutUrls?.isLogout != undefined && !pageDetails.logoutUrls.isLogout(details)) {
                return;
            }

            await setLoggedIn([pageId, false]);
            await setAuthenticationPaused([details.tabId, pageId, true]);
        }, getLogoutUrlFilters());
        browser.tabs.onRemoved.addListener((tabId, _) => clearPausedSites(tabId));
    }

    return bridgedFuncs;
}

export default { bridge, setAuthenticationPaused, clearPausedSites, shouldAutoLogin, isLoggedIn, getLastLoginTime, setLoggedIn }