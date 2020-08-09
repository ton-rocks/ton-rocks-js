async function test() {
    // predefined config
    const rocksTestnet = TonRocks.configs.RocksTestnet;

    // known blocks & hosts storage
    const storage = new TonRocks.storages.BrowserStorage(rocksTestnet.zero_state.filehashBase64());
    storage.load();
    storage.addBlock(rocksTestnet.zero_state);

    const AbiContract = TonRocks.AbiContract;
    await TonRocks.ContractV2.init();

    // connect to lite-server
    const liteClient = new TonRocks.providers.LiteClient(rocksTestnet);
    const lastBlock = await liteClient.connect();
    console.log('lastBlock', lastBlock);

    const ton = new TonRocks(liteClient, storage);
    const utils = TonRocks.utils;

    {
        // Block api object
        let block = new ton.bc.Block();

        // get latest block
        let blockId = await block.getLatestId();
        console.log('latestBlockId', blockId);

        if (!blockId.ok)
            return;
    }

    const bip39 = utils.bip39;
    const nacl = utils.nacl;

    let mnemonic = bip39.generateMnemonic();
    console.log(mnemonic);
    console.log('validate=', bip39.validateMnemonic(mnemonic));
    // Convert 12 word mnemonic to 32 byte seed
    let seed = await bip39.mnemonicToSeed(mnemonic);
    seed = seed.subarray(0, 32);
    console.log(utils.bytesToHex(seed));
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    console.log('keyPair', keyPair);

    let address;

    {
        address = new TonRocks.types.Address('-1:c47cecdf148d3911df3bb3dd7804828f0ae50376c03fc4f857c3b2522e0ba172');
        const sm = new AbiContract({
                abiPackage: TonRocks.EmbeddedAbiContracts.SetcodeMultisigWallet,
                address: address.toString(false)
            },
            liteClient
        );

        const smAddress = sm.getAddress();
        console.log('smAddress', smAddress);

        const smAccount = await sm.getAccount();
        console.log('smAccount', smAccount);

        const smTransactionsAll = await sm.getTransactions();
        console.log('smTransactionsAll', smTransactionsAll);

        const smTransactions13 = await sm.getTransactions(undefined, undefined, 13);
        console.log('smTransactions13', smTransactions13);

        const smTransactionsFrom = await sm.getTransactions(smTransactions13[smTransactions13.length-1].prev_trans_id);
        console.log('smTransactionsFrom', smTransactionsFrom);

        // get methods

        const smGetCustodians = sm.methods.getCustodians();

        const smGetCustodiansLocalResult = await smGetCustodians.runLocal();
        console.log('smGetCustodiansLocalResult', smGetCustodiansLocalResult);


        const smGetParameters = sm.methods.getParameters();

        const smGetParametersLocalResult = await smGetParameters.runLocal();
        console.log('smGetParametersLocalResult', smGetParametersLocalResult);

    }

    {
        const sm = new AbiContract({
                abiPackage: TonRocks.EmbeddedAbiContracts.SetcodeMultisigWallet,
                keys: keyPair
            },
            liteClient
        );

        const smDeploy = await sm.deploy({
            wc: -1,
            input: {"owners":["0x" + utils.bytesToHex(keyPair.publicKey)], "reqConfirms":1},
            header: undefined,
            init: undefined
        });
        const smAddress = smDeploy.getAddress();
        console.log('smAddress', smAddress.toString());
        address = smAddress;

        const smDeployMessage = await smDeploy.getMessage();
        console.log('smDeployMessage', smDeployMessage);

        const smDeployFee = await smDeploy.estimateFee();
        console.log('smDeployFee', smDeployFee);

        const smDeployLocal = await smDeploy.runLocal();
        console.log('smDeployLocal', smDeployLocal);

        console.log('Wait for account init:', smAddress.toString());

        await (new Promise(resolve => setTimeout(resolve, 10000)));

        while (true) {
            try {
                const smAccount = await sm.getAccount();
                console.log('Account state:', smAccount);
                if (smAccount.type !== TonRocks.ContractV2.AccountType.none)
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

        const smSubmitTransaction = sm.methods.submitTransaction({
            input: {"dest":"-1:2f5a3cc56bc231a5ec8f7284010bb7962fe43d1bdd877c82076293160400af6c","value":1000000000,"bounce":true,"allBalance":false,"payload":"te6ccgEBAQEAAgAAAA=="},
            header: undefined
        });
        const smSubmitTransactionMessage = await smSubmitTransaction.getMessage();
        console.log('smSubmitTransactionMessage', smSubmitTransactionMessage);

        const smSubmitTransactionFee = await smSubmitTransaction.estimateFee();
        console.log('smSubmitTransactionFee', smSubmitTransactionFee);

        const smSubmitTransactionLocalResult = await smSubmitTransaction.runLocal({
            fullRun: true
        });
        console.log('smSubmitTransactionLocalResult', smSubmitTransactionLocalResult);

        let transactionNum = 15;
        for (let i = 0; i < transactionNum; i++) {
            const smSubmitTransactionResult = await smSubmitTransaction.run();
            console.log('smSubmitTransactionResult', i, smSubmitTransactionResult);
        }

        // get

        const smGetCustodians = sm.methods.getCustodians();

        const smGetCustodiansLocalResult = await smGetCustodians.runLocal();
        console.log('smGetCustodiansLocalResult', smGetCustodiansLocalResult);


        const smGetParameters = sm.methods.getParameters();

        const smGetParametersLocalResult = await smGetParameters.runLocal();
        console.log('smGetParametersLocalResult', smGetParametersLocalResult);
    }


}

window.addEventListener('load', () => {
(async () => {
    await test();
})();
});
