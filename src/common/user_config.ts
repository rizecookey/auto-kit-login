import browser from 'webextension-polyfill';
import * as configLoader from './config';

const config = configLoader.getConfig();

const defaultUserConfig = getDefaultUserConfig();

function getDefaultUserConfig() {
    let userConfig: any = {
        enabled: true,
        autologinPages: {}
    };

    for (let id in config.pages) {
        userConfig.autologinPages[id] = true;
    }

    return userConfig;
}

async function get(): Promise<any> {
    let modified = (await browser.storage.local.get('userConfig'))?.userConfig;

    return mergeRecursive(defaultUserConfig, modified);
}

async function set(newUserConfig: any) {
    let userConfig = await get();
    let merged = mergeRecursive(defaultUserConfig, userConfig, newUserConfig);

    await browser.storage.local.set({
        userConfig: merged
    });
}

function mergeRecursive(...objects: any[]) {
    let merged: any = {};

    for (let object of objects) {
        for (let key in object) {
            if (typeof object[key] == 'object') {
                merged[key] = mergeRecursive(merged[key], object[key]);
            } else {
                merged[key] = object[key];
            }
        }
    }

    return merged;
}

export { get, set }