
var blockForRef;
/*
file_hash: Uint32Array(8) [658838343, 695902356, 1428720169, 1424633489, 1018050317, 492063929, 3685580618, 4025113653]
root_hash: Uint32Array(8) [3148955710, 1943225654, 1054771022, 1370635331, 2019297237, 2620190021, 133850716, 4155409007]
seqno: 157958
shard: BN {negative: 0, words: Array(3), length: 3, red: null}
workchain: -1
*/

async function testBlockAPI()
{
    console.log('BlockAPI test start');

    // Block api object
    let blockAPI = new TonRocks.bc.Block();

    // get latest block
    let blockId = await blockAPI.callMethod(10, () => blockAPI.getLatestId());
    console.log('latestBlockId', blockId);
    assert(blockId.ok);

    // validate latest block
    let latestBlockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId.id));
    console.log('latestBlockValid', latestBlockValid);
    assert(latestBlockValid.ok && latestBlockValid.valid);

    // get block header
    let blockHeader = await blockAPI.callMethod(10, () => blockAPI.getHeader(blockId.id));
    console.log('blockHeader', blockHeader);
    assert(blockHeader.ok && blockHeader.blockHeader);

    // get full block data
    let blockData = await blockAPI.callMethod(10, () => blockAPI.getData(blockId.id));
    console.log('blockData', blockData);
    assert(blockData.ok && blockData.block);

    // get block shards
    let shards = await blockAPI.callMethod(10, () => blockAPI.getShards(blockId.id));
    console.log('shards', shards);
    assert(shards.ok && shards.shardHashes);

    blockForRef = {
        file_hash: blockId.id.file_hash,
        root_hash: blockId.id.root_hash,
        seqno: blockId.id.seqno,
        start_lt: blockData.block.info.start_lt,
        end_lt: blockData.block.info.end_lt,
        utime: blockData.block.info.gen_utime
    };

    await testConfigs(blockAPI, blockId);
    await testBlockSearch(blockAPI);
    await testRemoteSmc(blockAPI, blockId);
    await testAccounts(blockAPI, blockId);
    await testProofs(blockAPI);

    console.log('BlockAPI test done');
}

async function testConfigs(blockAPI, blockId)
{
    // get existing config
    let config34 = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id, 34));
    console.log('config34', config34);
    assert(config34.ok && config34.configParam);

    // get nonexisting config
    let config80 = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id, 80));
    console.log('config80', config80);
    assert(config80.ok && !config80.configParam);

    // get all configs
    let configAll = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id));
    console.log('configAll', configAll);
    assert(configAll.ok && configAll.configParams);
}

async function testGetElectorAddr(blockAPI, blockId)
{
    // get elector address
    let config1 = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id, 1));
    console.log('config1', config1);
    assert(config1.ok && config1.configParam);

    const electorAddr = '-1:' + TonRocks.utils.bytesToHex(config1.configParam.elector_addr);
    console.log('electorAddr', electorAddr);
    assert(electorAddr === '-1:3333333333333333333333333333333333333333333333333333333333333333');

    return electorAddr;
}


async function testAccounts(blockAPI, blockId)
{
    const addr = await testGetElectorAddr(blockAPI, blockId);

    // get nonexisting account state (basechain)
    let account = await blockAPI.callMethod(10, () => blockAPI.getAccountState(blockId.id, '0:003d8af297b8a29f86360fa4012b8cc1e9f5748003744a1d3a5bb966c6213f00'));
    console.log('account nonexisting basechain', account);
    assert(account.ok && account.account.type === 'none');

    // get nonexisting account state (masterchain)
    account = await blockAPI.callMethod(10, () => blockAPI.getAccountState(blockId.id, '-1:003d8af297b8a29f86360fa4012b8cc1e9f5748003744a1d3a5bb966c6213f00'));
    console.log('account nonexisting basechain', account);
    assert(account.ok && account.account.type === 'none');

    // get existing account state
    account = await blockAPI.callMethod(10, () => blockAPI.getAccountState(blockId.id, addr));
    console.log('account existing', account);
    assert(account.ok && account.account.type !== 'none');

    // get transactions list (5)
    let transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(5, addr, account.lastTransLt, account.lastTransHash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 5);
    let lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 12)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(12, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 12);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 1)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(1, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 1);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 10)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(10, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 10);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 101)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(101, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 101);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 202)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(202, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 202);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 2000)
    for (let i = 0; i < 2; i++) {
        transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(1000, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
        console.log('account transactions', transactions);
        assert(transactions.ok && transactions.transactionList.length > 0);
        lastT = transactions.transactionList[transactions.transactionList.length-1];
    }
}

async function testBlockSearch(blockAPI)
{
    // lookup by seqno
    let blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16),
        seqno: blockForRef.seqno
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId));
    console.log('lookup block by seqno', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);

    // lookup by utime
    blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16)
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId, undefined, blockForRef.utime));
    console.log('lookup block by utime', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);

    // lookup by lt (start_lt)
    blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16)
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId, blockForRef.start_lt));
    console.log('lookup block by lt', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);

    // lookup by lt (end_lt)
    blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16)
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId, blockForRef.end_lt));
    console.log('lookup block by lt', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);
}

async function testProofs(blockAPI)
{
    // check backward proof
    storage.clear();

    // get latest block
    let blockId = await blockAPI.callMethod(10, () => blockAPI.getLatestId());
    console.log('latestBlockId', blockId);
    assert(blockId.ok);

    if (!blockId.ok)
        return;

    storage.addBlock(blockId.id);

    // validate block
    const blockValid = await blockAPI.callMethod(10, () => blockAPI.validate(rocksTestnet.zero_state));
    console.log('zerostate blockValid', blockValid);
    assert(blockValid.ok && blockValid.valid);
    
    storage.clear();

    storage.addBlock(rocksTestnet.zero_state);

    // get latest block
    blockId = await blockAPI.callMethod(10, () => blockAPI.getLatestId());
    console.log('latestBlockId', blockId);
    assert(blockId.ok);

    // forward proof
    let latestBlockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId.id));
    console.log('latestBlockValid', latestBlockValid);
    assert(latestBlockValid.ok && latestBlockValid.valid);
}


async function testRemoteSmc(blockAPI, blockId)
{
    // contracts test

    const electorAddr = await testGetElectorAddr(blockAPI, blockId);

    // REMOTE: get elector account state
    let params = new TonRocks.types.Cell();
    params.bits.writeBytes(new Uint8Array(3));
    let paramBoc = await params.toBoc(false, false, false);
    console.log(params, paramBoc);
    let res = await blockAPI.callMethod(10, () => blockAPI.runSmcMethod(blockId.id, electorAddr, 'participant_list', paramBoc));
    console.log('elector participant_list', res);
    assert(res.ok);

    // REMOTE: get elector election id
    res = await blockAPI.callMethod(10, () => blockAPI.runSmcMethod(blockId.id, electorAddr, 'active_election_id', paramBoc));
    console.log('elector active_election_id', res);
    assert(res.ok);
}

/*
async function testTodo1(blockAPI, blockId)
{
    // get elector account state
    account = await blockAPI.getAccountState(blockId.id, electorAddr);
    console.log('account elector', account);
    if (!account.ok) return;

    const codeCell = account.account.storage.state.code;
    const dataCell = account.account.storage.state.data;

    const CODE = TonRocks.utils.bytesToBase64(await codeCell.toBoc(false, false, false));
    const DATA = TonRocks.utils.bytesToBase64(await dataCell.toBoc(false, false, false));

    const cc = await ton.types.Cell.fromBoc(TonRocks.utils.base64ToBytes(CODE));
    const dd = await ton.types.Cell.fromBoc(TonRocks.utils.base64ToBytes(DATA));

    console.log('CODE', codeCell, CODE, cc);
    console.log('DATA', dataCell, DATA, dd);

    let result = await client.contracts.runGet({
        codeBase64: CODE,
        dataBase64: DATA,
        functionName: 'participant_list',
    });
    console.log('runGet', result);
    const participans = client.contracts.arrayFromCONS(result.output[0]);
    console.log('participant_list', participans);

    result = await client.contracts.runGet({
        codeBase64: CODE,
        dataBase64: DATA,
        functionName: 'active_election_id',
    });
    console.log('active_election_id', result);
}
*/