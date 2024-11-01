import { BridgeEndpoint, setEndpoint } from "./bridge";

const bridgedFuncs: ((params: any) => any)[] = [];

type BridgedModule = {
    bridge(): ((params: any) => any)[]
}

function initBridge(endpoint: BridgeEndpoint, modules: BridgedModule[]) {
    setEndpoint(endpoint);

    // store references to bridged functions to ensure that they are always initialized on both sides
    for (let module of modules) {
        bridgedFuncs.push(...module.bridge());
    }
}

export { initBridge }