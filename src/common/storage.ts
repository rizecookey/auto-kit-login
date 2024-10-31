import { Storage } from 'webextension-polyfill'

class StorageObject<T> {
    private name: string;
    private storage: Storage.StorageArea;
    private initialSetupPromise: Promise<any>;

    constructor(name: string, storage: Storage.StorageArea, defaultValue: T) {
        this.name = name;
        this.storage = storage;
        this.initialSetupPromise = (async () => {
            if ((await storage.get(name))[name] === undefined) {
                console.log(`initializing storage value ${name}`);
                let initial = {} as any;
                initial[name] = defaultValue;
                await storage.set(initial);
            }
        })();
    }

    async with(callback: (value: T) => (T | void) | Promise<T | void>): Promise<void> {
        let value = await this.get();
        let result = await Promise.resolve(callback(value));
        if (result !== undefined) {
            value = result;
        }
        await this.set(value);
    }

    async get(): Promise<T> {
        await this.initialSetupPromise;

        return (await this.storage.get(this.name))[this.name] as T;
    }

    async set(value: T): Promise<void> {
        await this.initialSetupPromise;

        let newStored = {} as any;
        newStored[this.name] = value;
        await this.storage.set(newStored);
    }
}

function storage<T>(name: string, storage: Storage.StorageArea, defaultValue: T): StorageObject<T> {
    return new StorageObject<T>(name, storage, defaultValue);
}

export { storage }