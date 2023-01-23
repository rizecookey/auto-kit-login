let $ = require('jquery');
const Constants = require('./constants');

$('#sbmt').on('click', () => grabAndSave());

chrome.runtime.sendMessage({
    credentialGrabber: {
        initialized: true
    }
});

function grabAndSave() {
    let username = $('input[name="j_username"]').val();
    let password = $('input[name="j_password"]').val();

    let storedObject = {};
    storedObject[Constants.LOGIN_DETAILS_KEY] = {
        username: username,
        password: password
    };
    chrome.storage.local.set(storedObject);
    chrome.runtime.sendMessage({
        credentialGrabber: {
            storedCredentials: username
        }
    });
}