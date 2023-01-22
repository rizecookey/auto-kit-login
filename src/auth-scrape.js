var $ = require('jquery');

async function makeLoginRequest() {
    /*var response = await fetch('https://ilias.studium.kit.edu/shib_login.php?target=root_1');
    let url = response.url;*/

    setTimeout(() => chrome.runtime.sendMessage({ auth_redirect: 'https://ilias.studium.kit.edu' }), 2000);
}

makeLoginRequest();