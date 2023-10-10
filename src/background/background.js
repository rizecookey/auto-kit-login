const autoLogin = require('./autologin')
const loginSaver = require('./login_saver');

console.log('background script initialized');
registerListeners();

function registerListeners() {
    autoLogin.registerListeners();
    loginSaver.registerListeners();
}