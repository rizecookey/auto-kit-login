const jsdom = require('jsdom');
const { JSDOM } = jsdom;

var makingRequest = false;

chrome.webRequest.onBeforeRequest.addListener((details) => {
    if (makingRequest) return;
    chrome.cookies.getAll({
        domain: 'kit.edu'
    }, (cookies) => {
        let sessionCookie = cookies.find(cookie => cookie.name.startsWith('_shibsession'));
        if (!sessionCookie) {
            makeLoginRequest();
        }
    });
}, {
    urls: [
        'https://ilias.studium.kit.edu/*'
    ]
});

async function makeLoginRequest() {
    console.log('Session cookie not found! Fetching login page');

    makingRequest = true;
    var response = await fetch('https://ilias.studium.kit.edu/shib_login.php?target=root_1');
    let url = response.url;
    //let dom = new JSDOM(await response.text());
    console.log(await reponse.text());
}