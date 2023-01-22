var $ = require('jquery');

async function makeLoginRequest() {
    /*var response = await fetch('https://ilias.studium.kit.edu/shib_login.php?target=root_1');
    let url = response.url;*/

    var url = new URL(window.location.href);
    var redirectTo = url.searchParams.get('redirect_to');

    setTimeout(() => chrome.runtime.sendMessage({ auth_redirect: redirectTo }), 2000);
}

makeLoginRequest();