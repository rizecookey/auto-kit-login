var $ = require('jquery');

async function makeLoginRequest() {
    console.log('Session cookie not found! Fetching login page');

    var response = await fetch('https://ilias.studium.kit.edu/shib_login.php?target=root_1');
    let url = response.url;

    await chrome.runtime.sendMessage({ closeTab: true })
}

makeLoginRequest();