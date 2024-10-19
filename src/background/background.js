import * as autoLogin from './autologin';
import { browserType } from '../common/browser_type';

console.log('background script initialized');
console.log(`platform: ${browserType}`);
registerListeners();

function registerListeners() {
    autoLogin.registerListeners();
}