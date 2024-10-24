import browser from 'webextension-polyfill'

import * as configLoader from '../common/config';
import { AuthenticatorType } from '../common/config';
import * as userConfigManager from '../common/user_config';
import { getAuthenticator } from './authenticators';

import { browserType } from '../common/platform.json';

const config = configLoader.getConfig();
const pageParameters = config.extension.pageParameters;

let logger: HTMLElement | null;
let pageDetailsId: string | null;
let loginPage: URL | null;
let authenticatorType: AuthenticatorType | null;
let redirectTo: URL | null;

let errorDiv: HTMLElement | null;

async function start() {
    await setup();
    try {
        await makeLoginRequest(loginPage!!);
    } catch (error) {
        if (!(error instanceof Error)) {
            return;
        }

        console.error(error);
        browser.runtime.sendMessage({
            auth: {
                error: {
                    message: error.message,
                    stack: error.stack
                }
            }
        });
        errorDiv!!.style.display = 'block';
    }
}

async function setup(): Promise<void> {
    logger = document.getElementById('log');
    overwriteConsole();

    let url = new URL(window.location.href);

    pageDetailsId = url.searchParams.get(pageParameters.pageDetailsId)!!;
    let pageDetails = config.pages[pageDetailsId];

    loginPage = pageDetails.loginPage;
    authenticatorType = pageDetails.authenticator;
    redirectTo = new URL(url.searchParams.get(pageParameters.redirect)!!);

    let originalPageUrlSpan = document.getElementById('orig_page_url');
    originalPageUrlSpan!!.innerText = new URL(loginPage!!).hostname;
    errorDiv = document.getElementById('login_error');
    document.getElementById('retry')!!.onclick = function() {
        location.reload();
        return true;
    };
    document.getElementById('return')!!.onclick = async function() {
        let newUserConfig: any = {
            autologinPages: {}
        };
        newUserConfig.autologinPages[pageDetailsId!!] = false;
        await userConfigManager.set(newUserConfig);
        location.href = redirectTo!!.toString();
        return true;
    };
}

const tagsToReplace: {[key: string]: string} = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};

function replaceTag(tag: string): string {
    return tagsToReplace[tag] || tag;
}

function safeTagsReplace(str: string): string {
    if (!str) {
        return str;
    }
    return `${str}`.replace(/[&<>]/g, replaceTag);
}

function overwriteConsole(): void {
    let oldLog = console.log;
    let oldError = console.error;
    console.log = function() {
        printToLog([...arguments], false);
        oldLog(...arguments);
    }
    console.error = function() {
        printToLog([...arguments], true);
        oldError(...arguments);
    }
}

function printToLog(argumentsArray: any[], error: boolean) {
    let prefix = error ? '<span style="color:lightcoral">' : '';
    let suffix = (error ? '</span>' : '') + '<br/>'
    for (const element of argumentsArray) {
        if (typeof element == 'object') {
            if (element instanceof Error) {
                printToLog([getErrorMessage(element)], error);
                return;
            } else {
                logger!!.innerHTML += prefix + safeTagsReplace(JSON.stringify(element, undefined, 2)) + suffix;
            }
        } else {
            logger!!.innerHTML += prefix + safeTagsReplace(element) + suffix;
        }
    }
}

function getErrorMessage(error: Error): string {
    switch (browserType) {
        case 'firefox': return `${error.name}: ${error.message}\n  ${(error.stack || '').replaceAll(/\n/gm, "\n  ")}`;
        case 'chromium': return error.stack || '';
        default: return error.toString();
    }
}

async function makeLoginRequest(pageUrl: URL) {
    let authenticator = getAuthenticator(authenticatorType!!, pageDetailsId!!);
    await authenticator.authenticate(pageUrl);

    console.log('logged in, redirecting back');
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