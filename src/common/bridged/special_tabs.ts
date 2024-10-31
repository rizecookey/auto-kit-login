import browser, { Tabs, Windows } from 'webextension-polyfill';
import { bridged } from '../bridge/bridge';
import { storage } from '../storage';

const specialTabs = storage<number[]>('specialTabs', browser.storage.session, []);
const specialWindows = storage<number[]>('specialWindows', browser.storage.session, []);

const bridgedFuncs: ((params: any) => any)[] = []

const createSpecialTab = bridged(bridgedFuncs, 'background', 'createSpecialTab', async function (options: Tabs.CreateCreatePropertiesType) {
    const tab = await browser.tabs.create(options);
    if (tab.id) {
        await specialTabs.with(value => { value.push(tab.id!!); });
    }
    return tab;
});

const createSpecialWindow = bridged(bridgedFuncs, 'background', 'createSpecialWindow', async function (options: Windows.CreateCreateDataType) {
    if (browser.windows === undefined) {
        throw new Error("Not supported on this platform");
    }

    const window = await browser.windows.create(options);
    if (window.id) {
        await specialWindows.with(value => { value.push(window.id!!); });
    }
    return window;
});

const isSpecialTab = bridged(bridgedFuncs, 'background', 'isSpecialTab', async function (tabId: number) {
    return (await specialTabs.get()).includes(tabId);
});

const isSpecialWindow = bridged(bridgedFuncs, 'background', 'isSpecialWindow', async function (windowId: number) {
    return (await specialWindows.get()).includes(windowId);
});

function bridge() {
    browser.tabs.onRemoved.addListener(tabId => {
        specialTabs.with(value => value.filter(id => id != tabId));
    });

    if (browser.windows !== undefined) {
        browser.windows.onRemoved.addListener(windowId => {
            specialWindows.with(value => value.filter(id => id != windowId));
        });
    }

    return bridgedFuncs;
}

export { bridge, createSpecialTab, createSpecialWindow, isSpecialTab, isSpecialWindow }