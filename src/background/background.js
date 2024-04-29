const autoLogin = require('./autologin')
const loginSaver = require('./login_saver');
const { browserType } = require('./browser_type')

console.log('background script initialized');
console.log(`platform: ${browserType}`);
registerListeners();

function registerListeners() {
    autoLogin.registerListeners();
    loginSaver.registerListeners();
}