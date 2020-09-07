
var storage;
var rocksTestnet;
var ton;

async function testStartup() {
    // predefined config
    rocksTestnet = TonRocks.configs.RocksTestnet;

    // known blocks & hosts storage
    storage = new TonRocks.storages.BrowserStorage(rocksTestnet.zero_state.filehashBase64());
    storage.load();
    storage.addBlock(rocksTestnet.zero_state);

    await TonRocks.Contract.init();

    // connect to lite-server
    const liteClient = new TonRocks.providers.LiteClient(rocksTestnet);
    while (true) {
        const lastBlock = await liteClient.connect();
        if (lastBlock !== undefined) {
            console.log('connected. lastBlock:', lastBlock);
            break;
        }
    }

    // Main API object
    ton = new TonRocks(liteClient, storage);

    return ton;
}


async function testNewKeypair(privateKey)
{
    let seed;

    if (privateKey === undefined) {
        let mnemonic = TonRocks.utils.bip39.generateMnemonic();
        console.log('New mnemonic:', mnemonic);
        console.log('Validate mnemonic:', TonRocks.utils.bip39.validateMnemonic(mnemonic));

        // Convert 12 word mnemonic to 32 byte seed
        seed = await TonRocks.utils.bip39.mnemonicToSeed(mnemonic);
        seed = seed.subarray(0, 32);
    } else {
        seed = TonRocks.utils.hexToBytes(privateKey);
    }
    
    console.log('private key:', TonRocks.utils.bytesToHex(seed));

    const keyPair = TonRocks.utils.nacl.sign.keyPair.fromSeed(seed);
    console.log('keyPair:', keyPair);

    return keyPair;
}

function assert(expr) {
    if (!expr)  {
        console.assert(expr);
        debugger;
    }
}