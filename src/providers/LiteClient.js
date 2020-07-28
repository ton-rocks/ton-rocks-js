const Lite = require("madeline-ton").default;
const {BN} = require("../utils");
const {Address} = require("../types");
const {BlockId} = require("../blockchain/BlockId");

class LiteClient {
    constructor(options) {
        this.options = options;
        this.state = '';
        this.clientDiff = 0;
        this.serverDiff = 0;
        this.tonDiff = 0;
    }

    async connect() {
        this.liteclient = new Lite({
            config: this.options.config,
            wssProxies: this.options.wssProxies
        });
        try {
            await this.liteclient.connect();
            return await this.checkServer();
        } catch (e) {
            console.log("Cannot connect:", e);
        }
        return null;
    }

    getZeroState() {
        return this.options.zero_state;
    }

    async request(t, type, f) {
        let data;
        for (let i = 0; i < t; i++) {
            try {
                data = await f();
                if (data)
                    break;
            } catch (e) {
                console.log('Request error:', e);
            }
        }
        if (data === undefined) {
            throw Error('Request failed');
        }
        if (data._ == 'liteServer.error') {
            const code = data.code !== undefined ? data.code : 0;
            throw Error('liteserver error code ' + code);
        }
        if (type !== undefined && type != '' && data._ != type) {
            throw Error('Unexpected server reply type: ' + data._);
        }
        return data;
    }

    updateSyncInfo(masterchainInfoEx) {
        console.log('server time', masterchainInfoEx.now);
        const client_tm = Math.ceil(new Date().getTime() / 1000);
        console.log('client time', client_tm);

        this.clientDiff = masterchainInfoEx.now - client_tm;
        this.serverDiff = masterchainInfoEx.last_utime - masterchainInfoEx.now;
        this.tonDiff = masterchainInfoEx.last_utime - client_tm;

        console.log('client-server TIME_DIFF', this.clientDiff);
        console.log('server TIME_DIFF', this.serverDiff);
        console.log('client TIME_DIFF', this.tonDiff);

    }

    async checkServer() {

        try {
            console.log('Server info:');
            /*
            const version = await this.request(3, '', async () => {
                return await this.liteclient.getVersion();
            });
            console.log('version', version);

            const tm = await this.request(3, '', async () => {
                return await this.liteclient.getTime();
            });
            console.log('server time', tm.now);
            */

            const masterchainInfoEx = await this.request(3, 'liteServer.masterchainInfoExt', async () => {
                return await this.liteclient.getMasterchainInfo();
            });
            console.log('masterchainInfoEx', masterchainInfoEx);
            console.log('version', masterchainInfoEx.version);

            if (!masterchainInfoEx.ok)
                throw Error('Server version is too old');

            this.updateSyncInfo(masterchainInfoEx);

            let zeroBlockId = new BlockId().fromLiteId(masterchainInfoEx.init);
            zeroBlockId.seqno = 0;
            zeroBlockId.shard = new BN("8000000000000000", 16);
            if (!this.getZeroState().compare(zeroBlockId))
                throw Error("Invalid zero_state in server answer");
            else
                console.log("Server zero_state OK");


            const blockId = new BlockId().fromLiteId(masterchainInfoEx.last);

            return blockId;
        } catch (e) {
            console.log("Cannot get liteserver info:", e);
        }

        return null;
    }

    async getLatestBlockId() {
        let masterchainInfoEx = await this.request(3, 'liteServer.masterchainInfoExt', async () => {
            return await this.liteclient.getMasterchainInfo();
        });

        this.updateSyncInfo(masterchainInfoEx);

        const blockId = new BlockId().fromLiteId(masterchainInfoEx.last);

        return blockId;
    }


    async getBlock(blockId) {
        let block = await this.request(3, 'liteServer.blockData', async () => {
            // liteServer.getBlock id:tonNode.blockIdExt = liteServer.BlockData;  
            //console.log('liteServer.getBlock ', blockId.toLiteId());
            return await this.liteclient.methodCall('liteServer.getBlock', {
                id: blockId.toLiteId()
            });
            // liteServer.blockData id:tonNode.blockIdExt data:bytes = liteServer.BlockData;
        });
        block.id = new BlockId().fromLiteId(block.id);
        return block;
    }

    async getBlockHeader(blockId) {
        let block = await this.request(3, 'liteServer.blockHeader', async () => {
            // liteServer.getBlockHeader id:tonNode.blockIdExt mode:# = liteServer.BlockHeader;
            return await this.liteclient.methodCall('liteServer.getBlockHeader', {
                id: blockId.toLiteId()
            });
            // liteServer.blockHeader id:tonNode.blockIdExt mode:# header_proof:bytes = liteServer.BlockHeader;
        });
        block.id = new BlockId().fromLiteId(block.id);
        return block;
    }

    async lookupBlock(blockId, lt, utime) {
        let block = await this.request(3, 'liteServer.blockHeader', async () => {
            // tonNode.blockId workchain:int shard:long seqno:int = tonNode.BlockId;
            // liteServer.lookupBlock mode:# id:tonNode.blockId lt:mode.1?long utime:mode.2?int = liteServer.BlockHeader;
            let p = {
                mode: (lt || utime) ? undefined : 1,
                id: blockId.toLiteId(),
                lt: lt ? blockId.longFromBN(lt) : undefined,
                utime
            };
            return await this.liteclient.methodCall('liteServer.lookupBlock', p);
            // liteServer.blockHeader id:tonNode.blockIdExt mode:# header_proof:bytes = liteServer.BlockHeader;
        });
        block.id = new BlockId().fromLiteId(block.id);
        return block;
    }

    async getBlockProof(fromBlockId, toBlockId) {
        let res = await this.request(3, 'liteServer.partialBlockProof', async () => {
            // liteServer.getBlockProof mode:# known_block:tonNode.blockIdExt targetBlock:mode.0?tonNode.blockIdExt = liteServer.PartialBlockProof;
            return await this.liteclient.methodCall('liteServer.getBlockProof', {
                known_block: fromBlockId.toLiteId(),
                target_block: toBlockId.toLiteId()
            });
            // liteServer.partialBlockProof complete:Bool from:tonNode.blockIdExt to:tonNode.blockIdExt steps:(vector liteServer.BlockLink) = liteServer.PartialBlockProof;
        });
        res.from = new BlockId().fromLiteId(res.from);
        res.to = new BlockId().fromLiteId(res.to);
        for (let i = 0; i < res.steps.length; i++) {
            res.steps[i].from = new BlockId().fromLiteId(res.steps[i].from);
            res.steps[i].to = new BlockId().fromLiteId(res.steps[i].to);
        }
        return res;
    }

    async getAccountState(blockId, accountAddr) {
        let res = await this.request(3, 'liteServer.accountState', async () => {
            // liteServer.getAccountState id:tonNode.blockIdExt account:liteServer.accountId = liteServer.AccountState;
            return await this.liteclient.methodCall('liteServer.getAccountState', {
                id: blockId.toLiteId(),
                account: new Address(accountAddr).toString(true, true, true, false)
            });
            // liteServer.accountState id:tonNode.blockIdExt shardblk:tonNode.blockIdExt shard_proof:bytes proof:bytes state:bytes = liteServer.AccountState;
        });
        res.id = new BlockId().fromLiteId(res.id);
        res.shardblk = new BlockId().fromLiteId(res.shardblk);
        return res;
    }

    async sendMessage(body) {
        let res = await this.request(3, 'liteServer.SendMsgStatus', async () => {
            // liteServer.sendMessage body:bytes = liteServer.SendMsgStatus;
            return await this.liteclient.methodCall('liteServer.sendMessage', {
                body
            });
            // liteServer.sendMsgStatus status:int = liteServer.SendMsgStatus;
        });
        return res;
    }

    async runSmcMethod(blockId, accountAddr, method_id, params) {
        let res = await this.request(3, 'liteServer.RunMethodResult', async () => {
            // liteServer.runSmcMethod mode:# id:tonNode.blockIdExt account:liteServer.accountId method_id:long params:bytes = liteServer.RunMethodResult;
            return await this.liteclient.methodCall('liteServer.runSmcMethod', {
                id: blockId.toLiteId(),
                account: new Address(accountAddr).toString(true, true, true, false),
                method_id: blockId.longFromBN(method_id),
                params
            });
            // liteServer.runMethodResult mode:# id:tonNode.blockIdExt shardblk:tonNode.blockIdExt shard_proof:mode.0?bytes proof:mode.0?bytes state_proof:mode.1?bytes init_c7:mode.3?bytes lib_extras:mode.4?bytes exit_code:int result:mode.2?bytes = liteServer.RunMethodResult;
        });
        return res;
    }

    async getAllShardsInfo(blockId) {
        let res = await this.request(3, 'liteServer.allShardsInfo', async () => {
            // liteServer.getAllShardsInfo id:tonNode.blockIdExt = liteServer.AllShardsInfo;
            return await this.liteclient.methodCall('liteServer.getAllShardsInfo', {
                id: blockId.toLiteId()
            });
            // liteServer.allShardsInfo id:tonNode.blockIdExt proof:bytes data:bytes = liteServer.AllShardsInfo;
        });
        res.id = new BlockId().fromLiteId(res.id);
        return res;
    }

    async getTransactions(count, accountAddr, lt, hash) {
        let res = await this.request(3, 'liteServer.transactionList', async () => {
            // liteServer.getTransactions count:# account:liteServer.accountId lt:long hash:int256 = liteServer.TransactionList;
            return await this.liteclient.methodCall('liteServer.getTransactions', {
                count,
                account: new Address(accountAddr).toString(true, true, true, false),
                lt: new BlockId().longFromBN(lt),
                hash: new Uint32Array(hash.buffer)
            });
            // liteServer.transactionList ids:(vector tonNode.blockIdExt) transactions:bytes = liteServer.TransactionList;
        });
        for (let i = 0; i > res.ids.length; i++) {
            res.ids[i] = new BlockId().fromLiteId(res.ids[i]);
        }
        return res;
    }

    async getConfigAll(blockId) {
        let res = await this.request(3, 'liteServer.configInfo', async () => {
            // liteServer.getConfigAll mode:# id:tonNode.blockIdExt = liteServer.ConfigInfo;
            return await this.liteclient.methodCall('liteServer.getConfigAll', {
                id: blockId.toLiteId()
            });
            // liteServer.configInfo mode:# id:tonNode.blockIdExt state_proof:bytes config_proof:bytes = liteServer.ConfigInfo;
        });
        res.id = new BlockId().fromLiteId(res.id);
        return res;
    }

    async getConfigParams(blockId, params) {
        let res = await this.request(3, 'liteServer.configInfo', async () => {
            // liteServer.getConfigParams mode:# id:tonNode.blockIdExt param_list:(vector int) = liteServer.ConfigInfo;
            return await this.liteclient.methodCall('liteServer.getConfigParams', {
                id: blockId.toLiteId(),
                param_list: params
            });
            // liteServer.configInfo mode:# id:tonNode.blockIdExt state_proof:bytes config_proof:bytes = liteServer.ConfigInfo;
        });
        res.id = new BlockId().fromLiteId(res.id);
        return res;
    }

    async getSignedAddressList() {
        let res = await this.request(3, 'dht.Node', async () => {
            return await this.liteclient.methodCall('dht.getSignedAddressList', {});
        });
        return res;
    }
}


module.exports = {LiteClient};