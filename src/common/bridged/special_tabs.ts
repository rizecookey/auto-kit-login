import browser, { Tabs, Windows } from 'webextension-polyfill';
import { bridged } from '../bridge/bridge';

let specialTabs: number[] = [];
let specialWindows: number[] = [];

const bridgedFuncs: ((params: any) => any)[] = []

const createSpecialTab = bridged(bridgedFuncs, 'background', 'createSpecialTab', async function (options: Tabs.CreateCreatePropertiesType) {
    const tab = await browser.tabs.create(options);
    if (tab.id) {
        specialTabs.push(tab.id);
    }
    return tab;
});

const createSpecialWindow = bridged(bridgedFuncs, 'background', 'createSpecialWindow', async function (options: Windows.CreateCreateDataType) {
    if (browser.windows === undefined) {
        throw new Error("Not supported on this platform");
    }

    const window = await browser.windows.create(options);
    if (window.id) {
        specialWindows.push(window.id);
    }
    return window;
});

const isSpecialTab = bridged(bridgedFuncs, 'background', 'isSpecialTab', async function (tabId: number) {
    return specialTabs.includes(tabId);
});

const isSpecialWindow = bridged(bridgedFuncs, 'background', 'isSpecialWindow', async function (windowId: number) {
    return specialWindows.includes(windowId);
});

function bridge() {
    browser.tabs.onRemoved.addListener(tabId => {
        specialTabs = specialTabs.filter(id => id != tabId);
    });

    if (browser.windows !== undefined) {
        browser.windows.onRemoved.addListener(windowId => {
            specialWindows = specialWindows.filter(id => id != windowId);
        });
    }

    return bridgedFuncs;
}

export { bridge, createSpecialTab, createSpecialWindow, isSpecialTab, isSpecialWindow }