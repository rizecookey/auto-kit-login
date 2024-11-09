import browser from 'webextension-polyfill'
import { config, findPageDetailsForDomain } from "../../common/config";

function performAuthRedirection() {
    let pageParams = config.extension.pageParameters;
    let currentUrl = new URL(location.href);
    let [matchingDetailsId, _] = findPageDetailsForDomain(currentUrl.hostname);
    if (!matchingDetailsId) {
        console.error("no matching page id found for " + currentUrl.hostname);
        return;
    }

    let params = new URLSearchParams();
    params.append(pageParams.pageDetailsId, matchingDetailsId);
    params.append(pageParams.redirect, currentUrl.toString());

    browser.runtime.sendMessage({
        sessionTimeoutDetector: {
            redirect: browser.runtime.getURL(`${config.extension.authenticationPage}?${params.toString()}`)
        }
    });
}

export { performAuthRedirection }