import browser from 'webextension-polyfill'
import { config, AuthenticatorType } from '../common/config';
import userConfigManager from '../common/user_config';
import { getAuthenticator } from './authenticators';
import { browserType } from '../common/platform';
import { initBridge } from '../common/bridge/initializer';
import * as specialTabs from '../common/bridged/special_tabs'
import loginUtils from '../common/bridged/login_utils'

initBridge('page', [loginUtils, specialTabs]);

const pageParameters = config.extension.pageParameters;

let logger: HTMLElement | null;
let pageDetailsId: string | null;
let loginPage: URL | null;
let authenticatorType: AuthenticatorType | null;
let redirectTo: URL | null;

let errorDiv: HTMLElement | null;

let tabId: number | null;

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

    tabId = (await browser.tabs.getCurrent())?.id || null;

    pageDetailsId = url.searchParams.get(pageParameters.pageDetailsId)!!;
    let pageDetails = config.pages[pageDetailsId];

    loginPage = pageDetails.loginPage;
    authenticatorType = pageDetails.authenticator;
    redirectTo = new URL(url.searchParams.get(pageParameters.redirect)!!);

    let originalPageUrlSpan = document.getElementById('orig_page_url');
    originalPageUrlSpan!!.innerText = new URL(loginPage!!).hostname;
    errorDiv = document.getElementById('login_error');
    document.getElementById('retry')!!.onclick = function () {
        location.reload();
        return true;
    };
    document.getElementById('return')!!.onclick = async function () {
        let newUserConfig: any = {
            autologinPages: {}
        };
        newUserConfig.autologinPages[pageDetailsId!!] = false;
        await userConfigManager.set(newUserConfig);
        location.replace(redirectTo!!.toString());
        return true;
    };
    document.getElementById('pause')!!.onclick = async function () {
        await loginUtils.setAuthenticationPaused([tabId!!, Object.keys(config.pages), true]);
        location.replace(redirectTo!!.toString());
        return true;
    };
}

function overwriteConsole(): void {
    let oldLog = console.log;
    let oldError = console.error;
    console.log = function () {
        printToLog([...arguments], false);
        oldLog(...arguments);
    }
    console.error = function () {
        printToLog([...arguments], true);
        oldError(...arguments);
    }
}

function printToLog(argumentsArray: any[], error: boolean) {
    let messageElement = document.createElement('span');
    if (error) {
        messageElement.style.color = 'lightcoral';
    }
    let lineBreak = document.createElement('br');
    for (const element of argumentsArray) {
        if (typeof element == 'object') {
            if (element instanceof Error) {
                printToLog([getErrorMessage(element)], error);
                return;
            }
            messageElement.innerText += JSON.stringify(element, undefined, 2);
        } else {
            messageElement.innerText += element;
        }
    }

    logger?.appendChild(messageElement);
    logger?.appendChild(lineBreak);
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
    await redirectBack();
}

async function redirectBack() {
    await loginUtils.setAuthenticationPaused([tabId!!, pageDetailsId!!, true]);
    await browser.runtime.sendMessage({ auth: { success: true } })
    location.replace(redirectTo!!.toString());
}

start();