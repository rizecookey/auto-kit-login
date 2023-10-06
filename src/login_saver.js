const browser = require('webextension-polyfill');
const loginUtils = require('./login_utils');
const configLoader = require('./config');

const autologinPageFilters = configLoader.getAutologinPageFilters();
const config = configLoader.getConfig();
const loginUrlFilter = config.filters.login;
const fieldNames = {
    username: 'j_username',
    password: 'j_password'
}

let lastLoginRequestData;

async function onAuthFormRequest(details) {
    if (await loginUtils.isLoginSaved() || details.method != 'POST') {
        return;
    }

    let formDetails = details.requestBody?.formData;
    if (!formDetails[fieldNames.username] || !formDetails[fieldNames.password]) {
        return;
    }

    loginUtils.setNavigationIncomplete(true);
    lastLoginRequestData = {
        requestId: details.requestId,
        username: formDetails[fieldNames.username][0],
        password: formDetails[fieldNames.password][0]
    }
}

async function onAuthFormRequestComplete(details) {
    if (!lastLoginRequestData || details.requestId != lastLoginRequestData.requestId) {
        return;
    }

    if (headersInclude(details.responseHeaders, 'Set-Cookie')) { // login was successful
        await loginUtils.saveLogin(lastLoginRequestData.username, lastLoginRequestData.password);
        console.log(`saved login for user '${lastLoginRequestData.username}'`);
    }

    lastLoginRequestData = undefined;
}

function headersInclude(headers, headerName) {
    for (let header of headers) {
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
            return true;
        }
    }

    return false;
}

function onNavigationComplete(details) {
    loginUtils.setNavigationIncomplete(false);
}

function registerListeners() {
    browser.webRequest.onBeforeRequest.addListener(onAuthFormRequest, {
        urls: [loginUrlFilter]
    }, ['requestBody']);

    browser.webRequest.onCompleted.addListener(onAuthFormRequestComplete, {
        urls: [loginUrlFilter]
    }, ['responseHeaders', 'extraHeaders']);

    browser.webNavigation.onCompleted.addListener(onNavigationComplete, {
        url: autologinPageFilters
    });
}

module.exports = { registerListeners }