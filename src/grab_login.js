const Constant = require('./constants');

$('#sbmt').on('click', () => grabAndSave());

function grabAndSave() {
    let username = $('input[name="j_username"]').val();
    let password = $('input[name="j_password"]').val();

    let storedObject = {};
    storedObject[Constant.LOGIN_DETAILS_KEY] = {
        username: username,
        password: password
    };
    chrome.storage.local.set(storedObject);
}