var $ = require('jquery');

async function makeLoginRequest() {
    let response = await fetch('https://ilias.studium.kit.edu/shib_login.php?target=root_1');
    let url = response.url;
    let csrfToken = getCSRFToken(await response.text());


    setTimeout(() => redirectBack(), 2000);
}

function getCSRFToken(domString) {
    let value = $('input[name="csrf_token"]', $(domString)).val();
    return value;
}

function redirectBack() {
    var url = new URL(window.location.href);
    var redirectTo = url.searchParams.get('redirect_to');

    chrome.runtime.sendMessage({ authRedirect: redirectTo });
}

makeLoginRequest();