class TvmClient {
    constructor() {

    }

    static setLibrary(clientPlatform) {
        TvmClient.clientPlatform = clientPlatform;
    }

    async tryCreateLibrary() {
        const platform = TvmClient.clientPlatform;
        if (platform === null || platform === undefined) {
            return null;
        }
        TvmClient.coreLibrary = await platform.createLibrary();
        return TvmClient.coreLibrary;
    }

    async tryCreateCoreBridge() {
        const library = TvmClient.coreLibrary || await this.tryCreateLibrary();
        if (!library) {
            return;
        }
        if (library.coreCreateContext) {
            this._context = await new Promise((resolve) => library.coreCreateContext(resolve));
            this._coreBridge = {
                request: (method, paramsJson, onResult) => {
                    if (TvmClient.coreLibrary) {
                        TvmClient.coreLibrary.coreRequest(
                            this._context,
                            method,
                            paramsJson,
                            onResult,
                        );
                    }
                },
            };
        } else {
            this._coreBridge = library;
        }
    }

    async getCoreBridge() {
        if (!this._coreBridge) {
            await this.tryCreateCoreBridge();
        }
        return this._coreBridge;
    }

    /**
     * Requests a core for specified method and parameters.
     * @param {string} method Method name
     * @param {Object} params Method parameters will be stringified into JSON
     * @return {Promise<Object>}
     */
    async requestCore(method, params) {
        const coreBridge = await this.getCoreBridge();
        if (!coreBridge) {
            throw Error('no tvm');
        }
        return new Promise((resolve, reject) => {
            coreBridge.request(
                method,
                params !== undefined ? (JSON.stringify(params) || '') : '',
                (resultJson, errorJson) => {
                    if (errorJson) {
                        reject(JSON.parse(errorJson));
                    } else if (resultJson) {
                        resolve(JSON.parse(resultJson));
                    } else {
                        resolve(({}));
                    }
                },
            );
        });
    }
}


module.exports = {TvmClient};