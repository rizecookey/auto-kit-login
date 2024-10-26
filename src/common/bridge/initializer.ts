import { BridgeEndpoint, setEndpoint } from "./bridge";
import * as specialTabs from './../bridged/special_tabs'

const bridgedFuncs: ((params: any) => any)[] = []

function initBridge(endpoint: BridgeEndpoint) {
    setEndpoint(endpoint);

    // store references to bridged functions to ensure that they are always initialized on both sides
    bridgedFuncs.push(...specialTabs.bridge());
}

export { initBridge }