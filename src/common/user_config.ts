import browser from 'webextension-polyfill';
import { config } from './config';

type UserConfig = {
    enabled: boolean,
    autoSubmitLoginForm: boolean,
    loginWindowType: 'popup' | 'tab';
    autologinPages: { [key: string]: boolean },
}

type PartialUserConfig = {
    [Property in keyof UserConfig]?: UserConfig[Property];
}

const defaultUserConfig = getDefaultUserConfig();

function getDefaultUserConfig(): UserConfig {
    let userConfig: UserConfig = {
        enabled: true,
        autoSubmitLoginForm: false,
        loginWindowType: browser.windows !== undefined ? 'popup' : 'tab',
        autologinPages: {}
    };

    for (let id in config.pages) {
        userConfig.autologinPages[id] = true;
    }

    return userConfig;
}

async function get(): Promise<UserConfig> {
    let modified = (await browser.storage.local.get('userConfig'))?.userConfig;

    return mergeRecursive(defaultUserConfig, modified);
}

async function set(newUserConfig: PartialUserConfig) {
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

export default { get, set }
export { UserConfig, PartialUserConfig }