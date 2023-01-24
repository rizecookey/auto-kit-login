let browser = require('webextension-polyfill');

let $ = require('jquery');
const config = require('./config');

$('#sbmt').on('click', () => grabAndSave());

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