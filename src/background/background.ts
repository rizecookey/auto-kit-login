import * as autoLogin from './autologin';
import { browserType } from '../common/platform.json';

console.log('background script initialized');
console.log(`platform: ${browserType}`);
registerListeners();

function registerListeners(): void {
    autoLogin.registerListeners();
}