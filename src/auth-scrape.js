let $ = require('jquery');
const Constants = require('./constants')

const url = new URL(window.location.href);
let loginPage = url.searchParams.get(Constants.Param.LOGIN_URL)
let redirectTo = url.searchParams.get(Constants.Param.REDIRECT);

async function makeLoginRequest(pageUrl) {
    let loginPageResponse = await fetch(pageUrl);
    let loginUrl = loginPageResponse.url;
    let loginForm = await getFormDetails(loginPageResponse);

    let loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: Constants.POST_HEADERS,
        body: loginForm
    });

    let samlRequestData = await scrapeSAMLRequestData(loginResponse);
    let result = await fetch(samlRequestData.url, {
        method: 'POST',
        headers: Constants.POST_HEADERS,
        body: samlRequestData.formData
    });

    if (result.ok) {
        console.log('logged in as: ' + loginForm.get(Constants.Field.USERNAME)) 
    }

    redirectBack();
}

async function getFormDetails(fetchResponse) {
    let csrfToken = getCSRFToken(await fetchResponse.text());
    let loginDetails = getLoginDetails();

    let formData = new URLSearchParams();
    formData.append(Constants.Field.CSRF_TOKEN, csrfToken);
    formData.append(Constants.Field.USERNAME, loginDetails.username);
    formData.append(Constants.Field.PASSWORD, loginDetails.password);
    formData.append(Constants.Field.EVENT_ID_PROCEED, '');

    return formData;
}

async function scrapeSAMLRequestData(fetchResponse) {
    let domString = await fetchResponse.text();
    console.log(domString);
    let relayStateInput = $(`input[name="${Constants.Field.RELAY_STATE}"]`, $(domString));
    let url = relayStateInput.parents('form:first').prop('action');
    let relayState = relayStateInput.val()
    let samlResponse = $(`input[name="${Constants.Field.SAML_RESPONSE}"]`, $(domString)).val();

    let formData = new URLSearchParams();
    formData.append(Constants.Field.RELAY_STATE, relayState);
    formData.append(Constants.Field.SAML_RESPONSE, samlResponse);

    return {
        url: url,
        formData: formData
    };
}

function getCSRFToken(domString) {
    let value = $(`input[name="${Constants.Field.CSRF_TOKEN}"]`, $(domString)).val();
    return value;
}

function redirectBack() {
    chrome.runtime.sendMessage({ authRedirect: redirectTo });
}

async function getLoginDetails() {
    return await chrome.storage.local.get(Constants.LOGIN_DETAILS_KEY); //TODO set login somewhere
}

makeLoginRequest(loginPage);