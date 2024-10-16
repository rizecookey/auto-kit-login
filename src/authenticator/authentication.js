const browser = require('webextension-polyfill');
const { InvalidLoginError } = require('../error_types');

const configLoader = require('../config');
const userConfigManager = require('../user_config');
const { getAuthenticator } = require('./authenticators');

const config = configLoader.getConfig();
const pageParameters = config.extension.pageParameters;

let logger;
let pageDetailsId;
let loginPage;
let authenticatorType;
let redirectTo;

let errorDiv;

async function start() {
    await setup();
    try {
        await makeLoginRequest(loginPage);
    } catch (error) {
        console.error(error);
        browser.runtime.sendMessage({
            auth: {
                error: {
                    message: error.message,
                    stack: error.stack
                }
            }
        });
        errorDiv.style.display = 'block';
    }
}

async function setup() {
    logger = document.getElementById('log');
    overwriteConsole();

    let url = new URL(window.location.href);

    pageDetailsId = url.searchParams.get(pageParameters.pageDetailsId);
    let pageDetails = config.pages[pageDetailsId];

    loginPage = pageDetails.loginPage;
    authenticatorType = pageDetails.authenticator;
    redirectTo = url.searchParams.get(pageParameters.redirect);

    let originalPageUrlSpan = document.getElementById('orig_page_url');
    originalPageUrlSpan.innerText = new URL(loginPage).hostname;
    errorDiv = document.getElementById('login_error');
    document.getElementById('retry').onclick = function() {
        location.reload();
        return true;
    };
    document.getElementById('return').onclick = async function() {
        let newUserConfig = {
            autologinPages: {}
        };
        newUserConfig.autologinPages[pageDetailsId] = false;
        await userConfigManager.set(newUserConfig);
        location.href = redirectTo;
        return true;
    };
}

const tagsToReplace = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};

function replaceTag(tag) {
    return tagsToReplace[tag] || tag;
}

function safeTagsReplace(str) {
    if (!str) {
        return str;
    }
    return `${str}`.replace(/[&<>]/g, replaceTag);
}

function overwriteConsole() {
    let oldLog = console.log;
    let oldError = console.error;
    console.log = function() {
        printToLog(arguments, false);
        oldLog(...arguments);
    }
    console.error = function() {
        printToLog(arguments, true);
        oldError(...arguments);
    }
}

function printToLog(arguments, error) {
    let prefix = error ? '<span style="color:lightcoral">' : '';
    let suffix = (error ? '</span>' : '') + '<br/>'
    for (const element of arguments) {
        if (typeof element == 'object') {
            if (element instanceof Error) {
                printToLog([element.stack], error);
                return;
            } else {
                logger.innerHTML += prefix + safeTagsReplace(JSON.stringify(element, undefined, 2)) + suffix;
            }
        } else {
            logger.innerHTML += prefix + safeTagsReplace(element) + suffix;
        }
    }
}

async function makeLoginRequest(pageUrl) {
    let authenticator = getAuthenticator(authenticatorType, pageDetailsId);
    let successful = await authenticator.authenticate(pageUrl);

    if (successful) {
        console.log('logged in, redirecting back');
    }
    redirectBack();
}

function redirectBack() {
    browser.runtime.sendMessage({
        auth: {
            redirect: {
                url: redirectTo
            },
            pageDetailsId: pageDetailsId
        }
    });
}

start();