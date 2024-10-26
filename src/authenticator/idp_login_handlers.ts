import browser, { WebNavigation } from "webextension-polyfill";
import { config, PageConfig } from "../common/config";
import { getLoginDetector, LoginDetector } from "../common/login_detectors";
import { createSpecialWindow, createSpecialTab } from "../common/bridged/special_tabs"

abstract class IdpLoginHandler {
    protected pageId: string;
    protected pageConfig: PageConfig;
    protected loginUrl: URL;

    protected loginDetector: LoginDetector<any>;

    protected state: 'initialized' | 'handling_login' | 'done';

    constructor(pageId: string, loginUrl: URL) {
        this.pageId = pageId;
        this.pageConfig = config.pages[pageId];
        this.loginUrl = loginUrl;

        this.loginDetector = getLoginDetector(this.pageConfig.loginDetector);
        this.state = 'initialized';
    }

    abstract handleLogin(): Promise<void>;

    async isLoggedIn(): Promise<boolean> {
        return this.loginDetector.isLoggedIn(this.pageConfig.hostname);
    }
}

class PopupIdpLoginHandler extends IdpLoginHandler {
    async handleLogin(): Promise<void> {
        let popup = await createSpecialWindow({ type: 'popup', height: 600, width: 500, url: this.loginUrl.toString() });
        let handler = this;
        let isLoggedIn = false;

        return await new Promise<void>((resolve, reject) => {
            async function onNavigateInPopup(details: WebNavigation.OnCommittedDetailsType) {
                let windowId = (await browser.tabs.get(details.tabId)).windowId;
                if (popup.id == null || windowId != popup.id) {
                    return;
                }

                if (!(await handler.isLoggedIn())) {
                    return;
                }

                isLoggedIn = true;
                browser.windows.remove(popup.id);
                resolve();
            }

            async function onWindowClosed(windowId: number) {
                if (windowId != popup.id) {
                    return;
                }

                console.log("popup closed, removing listeners");
                browser.webNavigation.onCommitted.removeListener(onNavigateInPopup);
                browser.windows.onRemoved.removeListener(onWindowClosed);
                
                if (!isLoggedIn) {
                    reject(new Error("login window was closed without successful authentication"));
                }
            }

            browser.webNavigation.onCommitted.addListener(onNavigateInPopup);
            browser.windows.onRemoved.addListener(onWindowClosed)
        });
    }
}

class TabIdpLoginHandler extends IdpLoginHandler {
    async handleLogin(): Promise<void> {
        let tab = await createSpecialTab({ url: this.loginUrl.toString() });
        let handler = this;
        let isLoggedIn = false;

        return await new Promise<void>((resolve, reject) => {
            async function onNavigateInTab(details: WebNavigation.OnCommittedDetailsType) {
                if (details.tabId != tab.id || !(await handler.isLoggedIn())) {
                    return;
                }

                isLoggedIn = true;
                browser.tabs.remove(tab.id);
                resolve();
            }

            async function onTabClosed(tabId: number) {
                if (tabId != tab.id) {
                    return;
                }

                console.log("login tab closed, removing listeners");
                browser.webNavigation.onCommitted.removeListener(onNavigateInTab);
                browser.tabs.onRemoved.removeListener(onTabClosed);
                
                if (!isLoggedIn) {
                    reject(new Error("login window was closed without successful authentication"));
                }
            }

            browser.webNavigation.onCommitted.addListener(onNavigateInTab);
            browser.tabs.onRemoved.addListener(onTabClosed)
        });
    }
}

async function getIdpLoginHandler(pageId: string, loginUrl: URL): Promise<IdpLoginHandler> {
    if (browser.windows !== undefined) {
        return new PopupIdpLoginHandler(pageId, loginUrl);
    }

    return new TabIdpLoginHandler(pageId, loginUrl);
}

export { IdpLoginHandler, getIdpLoginHandler }