import browser, { Cookies } from "webextension-polyfill";
import { findPageDetailsForDomain } from "../common/config";
import userConfigManager from "../common/user_config";

type CookieId = {
    name: string,
    domain: string,
    path: string
}

let cookieEventIgnore: CookieId[] = [];

function shouldIgnoreEvent(id: CookieId): boolean {
    return cookieEventIgnore.some(obj => obj.name == id.name && obj.domain == id.domain && obj.path == id.path);
}

function ignoreNextEvent(id: CookieId): void {
    cookieEventIgnore.push(id);
}

function doNotIgnoreEvent(id: CookieId): void {
    cookieEventIgnore = cookieEventIgnore.filter(obj => obj.name != id.name || obj.domain != id.domain || obj.path != id.path);
}

async function extendCookieLifetime(originalCookie: Cookies.Cookie) {
    const userConfig = await userConfigManager.get();
    if (!userConfig.extendLoginCookieLifetime) {
        return;
    }

    const newExpirationDate = Date.now() / 1000 + userConfig.additionalLoginCookieLifetime;

    let cookieSetDetails: Cookies.SetDetailsType = {
        expirationDate: newExpirationDate,
        firstPartyDomain: originalCookie.firstPartyDomain,
        httpOnly: originalCookie.httpOnly,
        name: originalCookie.name,
        partitionKey: originalCookie.partitionKey,
        path: originalCookie.path,
        sameSite: originalCookie.sameSite,
        secure: originalCookie.secure,
        storeId: originalCookie.storeId,
        url: `https://${originalCookie.domain}${originalCookie.path}`,
        value: originalCookie.value
    };
    if (!originalCookie.hostOnly) {
        cookieSetDetails.domain = originalCookie.domain;
    }

    await browser.cookies.set(cookieSetDetails);
}

function registerListeners() {
    browser.cookies.onChanged.addListener(details => {
        let [_, pageConfig] = findPageDetailsForDomain(details.cookie.domain);
        if (details.removed || pageConfig?.expirationExtendableCookies == undefined
            || !pageConfig.expirationExtendableCookies.some(cookieRegex => cookieRegex.test(details.cookie.name))) {
            return;
        }

        const cookieId: CookieId = {name: details.cookie.name, domain: details.cookie.domain, path: details.cookie.path};
        if (shouldIgnoreEvent(cookieId)) {
            doNotIgnoreEvent(cookieId);
            return;
        }
        
        ignoreNextEvent(cookieId);
        extendCookieLifetime(details.cookie);
    });
}

export default { registerListeners }