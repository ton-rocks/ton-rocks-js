const utils = require("./utils");
const types = require("./types");
const providers = require("./providers");
const configs = require("./configs");
const {Contract} = require("./contract");
const Wallets = require("./contract/wallet").default;
const bc = require("./blockchain");
const {BrowserStorage} = require("./providers/Storage");
const { TONClient, setWasmOptions } = require('ton-client-web-js');
const {EmbeddedAbiContracts} = require('./abi/contract');
const {AbiContract, ContractV2} = require('./abi/AbiContract');
const version = '0.1.0';

class TonRocks {
    constructor(provider, storage) {
        this.version = version;
        this.types = types;
        this.utils = utils;
        this.bc = bc;

        this.bc.Block.prototype._provider = provider;
        if (storage)
            this.bc.Block.prototype._storage = storage;
        else if (typeof window !== 'undefined') {
            this.bc.Block.prototype._storage = new BrowserStorage('default');
        }

        this.Contract = Contract;

        this.providers = providers;
        this.configs = configs;
        this.storages = {BrowserStorage};

        this.TONClient = {TONClient, setWasmOptions};
        this.AbiContract = AbiContract;

        //this.wallet = new Wallets(this.provider);
    }
}

TonRocks.version = version;
TonRocks.types = types;
TonRocks.utils = utils;
TonRocks.bc = bc;
TonRocks.Contract = Contract;
TonRocks.providers = providers;
TonRocks.configs = configs;
TonRocks.storages = {BrowserStorage};
TonRocks.TONClient = {TONClient, setWasmOptions};
TonRocks.EmbeddedAbiContracts = EmbeddedAbiContracts;
TonRocks.AbiContract = AbiContract;
TonRocks.ContractV2 = ContractV2;

if (typeof window !== 'undefined') {
    window.TonRocks = TonRocks;
}

module.exports = TonRocks;