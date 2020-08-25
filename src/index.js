const utils = require("./utils");
const types = require("./types");

const providers = require("./providers");
const configs = require("./configs");

const {Contract} = require('./contract/Contract');

const {AbiContract} = require('./contract/AbiContract');
const {AbiPackages} = require('./contract/abi');

const {ClassicContract} = require('./contract/ClassicContract');
const {ClassicWallets} = require("./contract/wallet");

const bc = require("./blockchain");
const {BrowserStorage} = require("./providers/Storage");

const version = '0.1.0';

class TonRocks {
    constructor(provider, storage) {
        this.version = version;

        this.types = types;
        this.utils = utils;

        this.bc = bc;

        this.bc.Block._provider = provider;
        if (storage) {
            this.bc.Block._storage = storage;
        }
        else if (typeof window !== 'undefined') {
            this.bc.Block._storage = new BrowserStorage('default');
        }

        this.Contract = Contract;
        this.Contract._provider = provider;
        this.AbiContract = AbiContract;
        this.AbiPackages = AbiPackages;
        this.ClassicContract = ClassicContract;
        this.ClassicWallets = ClassicWallets;

        this.providers = providers;
        this.configs = configs;
        this.storages = {BrowserStorage};
    }
}

TonRocks.version = version;

TonRocks.types = types;
TonRocks.utils = utils;

TonRocks.bc = bc;

TonRocks.Contract = Contract;
TonRocks.AbiContract = AbiContract;
TonRocks.AbiPackages = AbiPackages;
TonRocks.ClassicContract = ClassicContract;
TonRocks.ClassicWallets = ClassicWallets;

TonRocks.providers = providers;
TonRocks.configs = configs;
TonRocks.storages = {BrowserStorage};

if (typeof window !== 'undefined') {
    window.TonRocks = TonRocks;
}

module.exports = TonRocks;