const autoLogin = require('./autologin')
const { browserType } = require('../browser_type')

console.log('background script initialized');
console.log(`platform: ${browserType}`);
registerListeners();

function registerListeners() {
    autoLogin.registerListeners();
}