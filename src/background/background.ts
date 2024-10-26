import { initBridge } from '../common/bridge/initializer'
import autoLogin from './autologin';
import { browserType } from '../common/platform';

initBridge('background');

console.log('background script initialized');
console.log(`platform: ${browserType}`);
registerListeners();

function registerListeners(): void {
    autoLogin.registerListeners();
}