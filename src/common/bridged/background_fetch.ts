import { bridged, BridgeEndpoint } from "../bridge/bridge";

let bridgedFuncs: ((params: any) => any)[] = [];

const fetchText = bridged(bridgedFuncs, 'background', 'fetchText', async function(url: string): Promise<string> {
    return await (await fetch(url)).text();
});

function bridge(endpoint: BridgeEndpoint) {
    return bridgedFuncs;
}

export { bridge, fetchText }