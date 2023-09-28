let browser = require('webextension-polyfill');

let $ = require('jquery');
const configLoader = require('./config');
const config = configLoader.getConfig();

$(document).on('submit', 'form', () => grabAndSave());

browser.runtime.sendMessage({
    credentialGrabber: {
        initialized: true
    }
});

function grabAndSave() {
    let username = $(`input[name="${config.loginSequence.field.username}"]`).val();
    let password = $(`input[name="${config.loginSequence.field.password}"]`).val();

    browser.storage.local.set({
        loginDetails: {
            username: username,
            password: password
        }
    });
    browser.runtime.sendMessage({
        credentialGrabber: {
            storedCredentials: username
        }
    });
}