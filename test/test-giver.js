
async function testStart() {
    // predefined config
    const rocksTestnet = TonRocks.configs.RocksTestnet;

    // known blocks & hosts storage
    const storage = new TonRocks.storages.BrowserStorage(rocksTestnet.zero_state.filehashBase64());
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

    const ton = new TonRocks(liteClient, storage);

    let address = await deployAndTestGiver();
}

async function deployAndTestGiver() {

    let address;

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.Giver,
        keys: TonRocks.utils.nacl.sign.keyPair()
    });

    const smDeploy = await sm.deploy({
        wc: 0,
        input: {},
        header: undefined,
        init: undefined
    });

    const smAddress = smDeploy.getAddress();
    console.log('smAddress', smAddress.toString());
    address = smAddress;

    console.log('Wait for account init:', smAddress.toString());

    await (new Promise(resolve => setTimeout(resolve, 10000)));

    while (true) {
        try {
            const smAccount = await sm.getAccount();
            console.log('Account state:', smAccount);
            if (smAccount.type !== TonRocks.Contract.AccountType.none)
                break;
        } catch (e) {
            console.log('Error:', e);
        }
        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    while (true) {
        const smDeployResult = await smDeploy.run();
        console.log('smDeployResult', smDeployResult);
        if (smDeployResult.ok)
            break;

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }


    const smGetCounter = sm.methods.getCounter();

    const smGetCounterLocalResult = await smGetCounter.runLocal();
    console.log('smGetCounterLocalResult', smGetCounterLocalResult);

    // test giver with 10 grams
    const smTransferToAddress = sm.methods.transferToAddress({
        input: {"destination":address.toString(false),"amount":10000000000},
        header: undefined
    });

    while (true) {
        const smTransferToAddressResult = await smTransferToAddress.run();
        console.log('smTransferToAddressResult', smTransferToAddressResult);
        if (smTransferToAddressResult.ok)
            break;

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    const smGetCounterLocalResult2 = await smGetCounter.runLocal();
    console.log('smGetCounterLocalResult2', smGetCounterLocalResult2);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);

    console.log('Giver test done. Your giver address: ' + address.toString(false));

    return address;
}


window.addEventListener('load', () => {
(async () => {
    await testStart();
})();
});
