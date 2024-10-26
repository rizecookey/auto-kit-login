import browser from "webextension-polyfill";

type BridgeEndpoint = 'background' | 'page';
type BridgeCall<T> = {
    to: BridgeEndpoint,
    name: string,
    params: T,
}

type BridgeMessage<T> = {
    bridgeCall?: BridgeCall<T>
}

let endpoint: BridgeEndpoint;

function setEndpoint(end: BridgeEndpoint) {
    endpoint = end
}

let functionsMap: Map<string, (params: any) => any> = new Map();

function bridged<T, R>(bridgedList: ((params: any) => any)[], to: BridgeEndpoint, name: string, func: (params: T) => Promise<R>): (params: T) => Promise<R> {
    functionsMap.set(name, func);
    let bridgedFunc = async (params: T) => {
        switch (to) {
            case endpoint: return await func(params);
            default: return await callAcross<T, R>(to, name, params);
        }
    }
    bridgedList.push(bridgedFunc)
    return bridgedFunc;
}

async function callAcross<T, R>(to: BridgeEndpoint, name: string, params: T): Promise<R> {
    console.log(`calling across to ${to} for ${name}`)
    return await browser.runtime.sendMessage<BridgeMessage<T>, R>({
        bridgeCall: {
            to,
            name,
            params,
        }
    });
}

browser.runtime.onMessage.addListener((message, _, sendResponse) => {
    (async () => {
        const bridgeMsg = message as BridgeMessage<any>;
        if (!bridgeMsg.bridgeCall) {
            sendResponse(undefined);
            return;
        }

        const bridgeCall = bridgeMsg.bridgeCall;
        if (bridgeCall.to !== endpoint || !functionsMap.has(bridgeCall.name)) {
            sendResponse(undefined);
            return;
        }

        console.log(`running cross call ${bridgeCall.name}`)

        let result = await functionsMap.get(bridgeCall.name)!!(bridgeCall.params);
        sendResponse(result);
    })();
    return true;
});

export { bridged, setEndpoint, BridgeEndpoint }