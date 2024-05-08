const browser = require('webextension-polyfill');
const { InvalidLoginError } = require('../common/error_types');

const configLoader = require('../common/config');
const userConfigManager = require('../common/user_config');
const { getAuthenticator } = require('./authenticators');

const config = configLoader.getConfig();
const pageParameters = config.extension.pageParameters;

let logger;
let pageDetailsId;
let loginPage;
let authenticatorType;
let redirectTo;
let loginDetails;

let errorDiv;

async function start() {
    await setup();
    console.log('current user: ' + loginDetails.username);
    try {
        await makeLoginRequest(loginPage);
    } catch (error) {
        console.error(error);
        browser.runtime.sendMessage({
            auth: {
                error: {
                    message: error.message,
                    stack: error.stack,
                    deleteLogin: error instanceof InvalidLoginError
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
    loginDetails = await fetchLoginDetails();

    let originalPageUrlSpan = document.getElementById('orig_page_url');
    originalPageUrlSpan.innerText = new URL(loginPage).hostname;
    errorDiv = document.getElementById('login_error');
    document.getElementById('retry').onclick = function () {
        location.reload();
        return true;
    };
    document.getElementById('return').onclick = async function () {
        let newUserConfig = {
            autologinPages: {}
        };
        newUserConfig.autologinPages[pageDetailsId] = false;
        await userConfigManager.set(newUserConfig);
        location.href = redirectTo;
        return true;
    };
}

function overwriteConsole() {
    let oldLog = console.log;
    let oldError = console.error;
    console.log = function () {
        printToLog(arguments, false);
        oldLog(...arguments);
    }
    console.error = function () {
        printToLog(arguments, true);
        oldError(...arguments);
    }
}

function printToLog(arguments, error) {
    for (const element of arguments) {
        if (element instanceof Error) {
            printToLog([element.stack], error);
            return;
        }

        const newLine = document.createElement('span');
        if (error) {
            newLine.style.color = 'lightcoral';
        }
        if (typeof element == 'object') {
            newLine.innerText = JSON.stringify(element, undefined, 2);
        } else {
            newLine.innerText = element;
        }
        logger.appendChild(newLine);
        logger.appendChild(document.createElement('br'));
    }
}

async function makeLoginRequest(pageUrl) {
    let authenticator = getAuthenticator(authenticatorType, pageDetailsId);
    let successful = await authenticator.authenticate(loginDetails.username, loginDetails.password, pageUrl);

    if (successful) {
        console.log('logged in as: ' + loginDetails.username);
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

async function fetchLoginDetails() {
    return (await browser.storage.local.get('loginDetails')).loginDetails;
}

start();