
async function testAbi() {
    console.log('ContractABI test start');

    let keyPair = await testNewKeypair();

    let address = await testAbiDeploy(keyPair);

    let transactions = await testAbiTransact(address, keyPair, 8);

    await testAbiGetMethods(address, transactions);

    console.log('ContractABI test done');
}

async function testAbiDeploy(keyPair)
{
    let address;

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
        keys: keyPair
    });

    const smDeploy = await sm.deploy({
        wc: -1,
        input: {"owners":["0x" + TonRocks.utils.bytesToHex(keyPair.publicKey)], "reqConfirms":1},
        header: undefined,
        init: undefined
    });
    const smAddress = smDeploy.getAddress();
    console.log('smAddress', smAddress.toString());
    address = smAddress;

    const smDeployMessage = await smDeploy.getMessage();
    console.log('smDeployMessage', smDeployMessage);
    assert(smDeployMessage.messageBodyBase64);

    const smDeployFee = await smDeploy.estimateFee();
    console.log('smDeployFee', smDeployFee);
    assert(smDeployFee.totalAccountFees.gt(1000));

    const smDeployLocal = await smDeploy.runLocal();
    console.log('smDeployLocal', smDeployLocal);
    assert(smDeployLocal.account.code && smDeployLocal.account.data);

    console.log('Wait for account init:', smAddress.toString());

    await testGiverGimme(smAddress, 10000000000);

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
        if (smDeployResult.ok) {
            assert(smDeployResult.sended && smDeployResult.confirmed);
            break;
        }

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    return address;
}

async function testAbiTransact(address, keyPair, transactionNum)
{
    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
        address,
        keys: keyPair
    });

    const smSubmitTransaction = sm.methods.submitTransaction({
        input: {"dest":giverAddress,"value":1000000000,"bounce":true,"allBalance":false,"payload":"te6ccgEBAQEAAgAAAA=="},
        header: undefined
    });
    const smSubmitTransactionMessage = await smSubmitTransaction.getMessage();
    console.log('smSubmitTransactionMessage', smSubmitTransactionMessage);
    assert(smSubmitTransactionMessage.messageBodyBase64);

    const smSubmitTransactionFee = await smSubmitTransaction.estimateFee();
    console.log('smSubmitTransactionFee', smSubmitTransactionFee);
    assert(smSubmitTransactionFee.totalAccountFees.gt(1000));

    const smSubmitTransactionLocalResult = await smSubmitTransaction.runLocal({
        fullRun: true
    });
    console.log('smSubmitTransactionLocalResult', smSubmitTransactionLocalResult);
    assert(smSubmitTransactionLocalResult.account.code && smSubmitTransactionLocalResult.account.data);

    let success = 0;
    for (let i = 0; i < transactionNum; i++) {
        const smSubmitTransactionResult = await smSubmitTransaction.run();
        console.log('smSubmitTransactionResult', i, smSubmitTransactionResult);
        if (smSubmitTransactionResult.ok) success++;
    }
    assert(success > 0);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);
    assert(smTransactionsAll.length === success + 2); // trans + initial + deploy

    return success;
}

async function testAbiGetMethods(address, transactions)
{
    address = new TonRocks.types.Address(address);

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
        address: address.toString(false)
    });

    // base contract methods (exists in all contracts)

    const smAddress = sm.getAddress();
    console.log('smAddress', smAddress);

    const smAccount = await sm.getAccount();
    console.log('smAccount', smAccount);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);
    assert(smTransactionsAll.length === transactions + 2);

    const smTransactions3 = await sm.getTransactions(undefined, undefined, 3);
    console.log('smTransactions3', smTransactions3);
    assert(smTransactions3.length === 3);

    const smTransactionsFrom = await sm.getTransactions(smTransactions3[smTransactions3.length-1].prev_trans_id);
    console.log('smTransactionsFrom', smTransactionsFrom);
    assert(smTransactionsFrom.length === transactions + 2 - 3 &&
        TonRocks.utils.compareBytes(smTransactionsFrom[0].hash, smTransactions3[smTransactions3.length-1].prev_trans_id.hash));

    // get methods (contract specific)

    const smGetCustodians = sm.methods.getCustodians();

    const smGetCustodiansLocalResult = await smGetCustodians.runLocal();
    console.log('smGetCustodiansLocalResult', smGetCustodiansLocalResult);
    assert(smGetCustodiansLocalResult.output.custodians.length === 1);

    const smGetParameters = sm.methods.getParameters();

    const smGetParametersLocalResult = await smGetParameters.runLocal();
    console.log('smGetParametersLocalResult', smGetParametersLocalResult);
    assert(smGetParametersLocalResult.output.requiredTxnConfirms === '0x1');

}
