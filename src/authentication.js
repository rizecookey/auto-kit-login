const browser = require('webextension-polyfill');
const { InvalidLoginError } = require('./error_types');

const configLoader = require('./config');
const config = configLoader.getConfig();

const { getAuthenticator } = require('./authenticators');
const pageParameters = config.extension.pageParameters;

let logger;
let pageDetailsId;
let loginPage;
let authenticatorType;
let redirectTo;
let loginDetails;

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
    }
}

async function setup() {
    logger = document.getElementById('log');
    overwriteConsole();

    let url = new URL(window.location.href);

    pageDetailsId = url.searchParams.get(pageParameters.pageDetailsId);
    pageDetails = config.pages[pageDetailsId];

    loginPage = pageDetails.loginPage;
    authenticatorType = pageDetails.authenticator;
    redirectTo = url.searchParams.get(pageParameters.redirect);
    loginDetails = await fetchLoginDetails();
    let originalPageUrlSpan = document.getElementById('orig_page_url');
    originalPageUrlSpan.innerText = new URL(loginPage).hostname;
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
            }
        }
    });
}

async function fetchLoginDetails() {
    return (await browser.storage.local.get('loginDetails')).loginDetails;
}

start();