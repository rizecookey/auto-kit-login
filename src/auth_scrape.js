let browser = require('webextension-polyfill');

let $ = require('jquery');
const configLoader = require('./config');
const config = configLoader.getConfig();

const { getAuthenticator } = require('./authenticators');
const pageParameters = config.extension.pageParameters;

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
        browser.runtime.sendMessage({
            auth: {
                error: {
                    message: error.message,
                    stack: error.stack
                }
            }
        });

        redirectBack();
    }
}

async function setup() {
    let url = new URL(window.location.href);

    loginPage = url.searchParams.get(pageParameters.loginUrl);
    redirectTo = url.searchParams.get(pageParameters.redirect);
    authenticatorType = url.searchParams.get(pageParameters.authenticatorType);
    loginDetails = await fetchLoginDetails();
    $('#orig_page_url').text(new URL(loginPage).hostname);
}

async function makeLoginRequest(pageUrl) {
    let authenticator = getAuthenticator(authenticatorType);
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