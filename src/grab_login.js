let browser = require('webextension-polyfill');

const configLoader = require('./config');
const config = configLoader.getConfig();

window.onload = function() {
    document.forms[0].onsubmit = grabAndSave;
    browser.runtime.sendMessage({
        credentialGrabber: {
            initialized: true
        }
    });
}

function grabAndSave() {
    let username = document.querySelector(`input[name="${config.loginSequence.field.username}"]`).value;
    let password = document.querySelector(`input[name="${config.loginSequence.field.password}"]`).value;

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