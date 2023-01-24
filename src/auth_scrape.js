let browser = require('webextension-polyfill');

let $ = require('jquery');
const config = require('./config');

let loginPage = undefined;
let redirectTo = undefined;
let loginDetails = undefined;

const fieldNames = config.loginSequence.field;

async function start() {
    await setup();
    console.log('current user: ' + loginDetails.username);
    try {
        await makeLoginRequest(loginPage);
    } catch (error) {
        browser.runtime.sendMessage({
            auth: {
                error: {
                    message: error.message
                }
            }
        });

        redirectBack();
    }
}

async function setup() {
    let url = new URL(window.location.href);

    loginPage = url.searchParams.get(config.extension.pageParameters.loginUrl);
    redirectTo = url.searchParams.get(config.extension.pageParameters.redirect);
    loginDetails = await fetchLoginDetails();
    $('#orig_page_url').text(new URL(loginPage).hostname);
}

async function makeLoginRequest(pageUrl) {
    let loginPageResponse = await fetch(pageUrl);
    let loginUrl = loginPageResponse.url;
    let loginForm = await getFormDetails(loginPageResponse);

    let loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: config.loginSequence.postHeaders,
        body: loginForm
    });

    let samlRequestData = await scrapeSAMLRequestData(loginResponse);
    let result = await fetch(samlRequestData.url, {
        method: 'POST',
        headers: config.loginSequence.postHeaders,
        body: samlRequestData.formData
    });

    if (result.ok) {
        console.log('logged in as: ' + loginForm.get(config.loginSequence.field.username));
    }

    redirectBack();
}

async function getFormDetails(fetchResponse) {
    let csrfToken = getCSRFToken(await fetchResponse.text());

    let formData = new URLSearchParams();
    formData.append(fieldNames.csrfToken, csrfToken);
    formData.append(fieldNames.username, loginDetails.username);
    formData.append(fieldNames.password, loginDetails.password);
    formData.append(fieldNames.eventIdProceed, '');

    return formData;
}

async function scrapeSAMLRequestData(fetchResponse) {
    let domString = await fetchResponse.text();
    let relayStateInput = $(`input[name="${fieldNames.relayState}"]`, $(domString));
    let url = relayStateInput.parents('form:first').prop('action');
    let relayState = relayStateInput.val()
    let samlResponse = $(`input[name="${fieldNames.samlResponse}"]`, $(domString)).val();

    let formData = new URLSearchParams();
    formData.append(fieldNames.relayState, relayState);
    formData.append(fieldNames.samlResponse, samlResponse);

    return {
        url: url,
        formData: formData
    };
}

function getCSRFToken(domString) {
    let value = $(`input[name="${fieldNames.csrfToken}"]`, $(domString)).val();
    return value;
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