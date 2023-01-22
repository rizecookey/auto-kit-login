var $ = require('jquery');

async function makeLoginRequest() {
    /*var response = await fetch('https://ilias.studium.kit.edu/shib_login.php?target=root_1');
    let url = response.url;*/

    setTimeout(() => redirectBack, 2000);
}

async function redirectBack() {
    var url = new URL(window.location.href);
    var redirectTo = url.searchParams.get('redirect_to');

    chrome.runtime.sendMessage({ authRedirect: redirectTo });
}

makeLoginRequest();