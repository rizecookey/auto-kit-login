const browser = require('webextension-polyfill');
const configLoader = require('../config');
const userConfigManager = require('../user_config');

const config = configLoader.getConfig();

const logoutUrlFilter = config.filters.logout;

let navigationIncomplete = false;

async function shouldAutoLogin(pageId) {
    let userConfig = await userConfigManager.get();
    return userConfig.enabled && userConfig.autologinPages[pageId] && !navigationIncomplete && await isLoginSaved();
}
async function isLoginSaved() {
    let loginDetails = (await browser.storage.local.get('loginDetails')).loginDetails;
    return loginDetails?.username && loginDetails.password;
}

async function deleteCredentials() {
    await browser.storage.local.remove('loginDetails');
    console.log('deleting login for currently logged in user');
}

async function saveLogin(username, password) {
    await browser.storage.local.set({
        loginDetails: {
            username: username,
            password: password
        }
    });
}

async function onVisitLogoutPage(details) {
    if (await isLoginSaved()) {
        await deleteCredentials();
    }
}

function setNavigationIncomplete(incomplete) {
    navigationIncomplete = incomplete;
}

browser.webRequest.onResponseStarted.addListener(onVisitLogoutPage, {
    urls: [logoutUrlFilter]
});

module.exports = { isLoginSaved, deleteCredentials, saveLogin, shouldAutoLogin, 
    setNavigationIncomplete }