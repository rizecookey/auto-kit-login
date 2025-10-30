import browser from 'webextension-polyfill';
import { config } from './config';
import { storage } from './storage';

type UserConfig = {
    enabled: boolean,
    extendLoginCookieLifetime: boolean,
    additionalLoginCookieLifetime: number,
    autoSubmitLoginForm: boolean,
    loginWindowType: 'popup' | 'tab';
    autologinPages: { [key: string]: boolean },
}

type PartialUserConfig = {
    [Property in keyof UserConfig]?: UserConfig[Property];
}

const defaultUserConfig = getDefaultUserConfig();
const userConfig = storage<PartialUserConfig>('userConfig', browser.storage.local, {});

function getDefaultUserConfig(): UserConfig {
    let defaults: UserConfig = {
        enabled: true,
        extendLoginCookieLifetime: true,
        additionalLoginCookieLifetime: 60 * 60 * 24 * 2,
        autoSubmitLoginForm: false,
        loginWindowType: 'tab',
        autologinPages: {}
    };

    for (let id in config.pages) {
        defaults.autologinPages[id] = true;
    }

    return defaults;
}

async function get(): Promise<UserConfig> {
    let modified = await userConfig.get();

    return mergeRecursive(defaultUserConfig, modified);
}

async function set(newUserConfig: PartialUserConfig) {
    let merged = mergeRecursive(defaultUserConfig, await userConfig.get(), newUserConfig) as UserConfig;

    await userConfig.set(merged);
}

function mergeRecursive(...objects: any[]): any {
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