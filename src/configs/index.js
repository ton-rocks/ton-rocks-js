const {BlockId} = require("../blockchain/BlockId");

const rocksTestnetConfig = require('./test.rocks.config.json');
const freetonTestnetConfig = require('./ton-global.config.json');


class NetworkOptions {
    constructor(config) {
        if (config["@type"] != 'config.global')
            throw Error('Invalid config');
        this.config = config;
        this.zero_state = new BlockId(config.validator.zero_state || config.validator.init_block);
        this.liteservers = config.liteservers;
        this.wssProxies = {};
        for (let i in this.liteservers) {
            if (this.liteservers[i].ws) {
                this.wssProxies[this.liteservers[i].ip] = this.liteservers[i].ws;
            }
        }
    }
}

const RocksTestnet = new NetworkOptions(rocksTestnetConfig);
const FreetonTestnet = new NetworkOptions(freetonTestnetConfig);

module.exports = {RocksTestnet, FreetonTestnet};