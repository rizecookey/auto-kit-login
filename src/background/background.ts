import { initBridge } from '../common/bridge/initializer'
import autoLogin from './autologin';
import cookieLifetimeExtension from './cookie_lifetime_extension';
import { browserType } from '../common/platform';
import * as specialTabs from '../common/bridged/special_tabs';
import loginUtils from '../common/bridged/login_utils';

initBridge('background', [loginUtils, specialTabs]);

console.log('background script initialized');
console.log(`platform: ${browserType}`);
registerListeners();

function registerListeners(): void {
    autoLogin.registerListeners();
    cookieLifetimeExtension.registerListeners();
}