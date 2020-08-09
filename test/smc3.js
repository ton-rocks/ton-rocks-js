async function test() {
    const utils = TonRocks.utils;

    // predefined config
    const rocksTestnet = TonRocks.configs.RocksTestnet;

    // known blocks & hosts storage
    const storage = new TonRocks.storages.BrowserStorage(rocksTestnet.zero_state.filehashBase64());
    storage.load();
    storage.addBlock(rocksTestnet.zero_state);

    const nacl = utils.nacl;

    seed = utils.hexToBytes('61828779dc419c5fc310eaf801b53a01fc76954ba70424f7ffb1877700c3b56a');
    pk = utils.hexToBytes('99fcb42751b75419213800dc6844813221136b249a21009abc66391f6c5ea2e8');

    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    console.log('keyPair', keyPair);

    if (!utils.compareBytes(keyPair.publicKey, pk))
        throw Error('something went wrong');

    const AbiContract = TonRocks.AbiContract;
    await TonRocks.ContractV2.init();

    // connect to lite-server
    const liteClient = new TonRocks.providers.LiteClient(rocksTestnet);
    const lastBlock = await liteClient.connect();
    console.log('lastBlock', lastBlock);

    const ton = new TonRocks(liteClient, storage);

    {
        // Block api object
        let block = new ton.bc.Block();

        // get latest block
        let blockId = await block.getLatestId();
        console.log('latestBlockId', blockId);

        if (!blockId.ok)
            return;
    }

    let address;


    {
        address = new TonRocks.types.Address('-1:c47cecdf148d3911df3bb3dd7804828f0ae50376c03fc4f857c3b2522e0ba172');
        const sm = new AbiContract({
                abiPackage: TonRocks.EmbeddedAbiContracts.SafeMultisigWallet,
                keys: keyPair,
                address: address.toString(false)
            },
            liteClient
        );

        const smAccount = await sm.getAccount();
        console.log('smAccount', smAccount);

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

        const smSubmitTransactionResult = await smSubmitTransaction.run();
        console.log('smSubmitTransactionResult', smSubmitTransactionResult);

        const smTransactions = await sm.getTransactions(undefined, undefined, 10);
        console.log('smTransactions', smTransactions);

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
