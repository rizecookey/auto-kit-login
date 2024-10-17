const browser = require('webextension-polyfill');
const configLoader = require('./config');

const config = configLoader.getConfig();

const defaultUserConfig = getDefaultUserConfig();

function getDefaultUserConfig() {
    let userConfig = {
        enabled: true,
        autologinPages: {}
    };

    for (let id in config.pages) {
        userConfig.autologinPages[id] = true;
    }

    return userConfig;
}

async function get() {
    let modified = (await browser.storage.local.get('userConfig'))?.userConfig;

    return mergeRecursive(defaultUserConfig, modified);
}

async function set(newUserConfig) {
    let userConfig = await get();
    let merged = mergeRecursive(defaultUserConfig, userConfig, newUserConfig);

    await browser.storage.local.set({
        userConfig: merged
    });
}

function mergeRecursive(...objects) {
    let merged = {};

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

module.exports = { get, set }