
async function testClassic() {
    console.log('ContractClassic test start');

    //await testClassicElector();

    await testElectorContract();

    let keyPair = await testNewKeypair();

    let address = await testClassicDeploy(keyPair);

    let transactions = await testClassicTransact(address, keyPair, 8);

    await testClassicGetMethods(address, transactions);


    console.log('ContractClassic test done');
}

async function testClassicDeploy(keyPair)
{
    let address;

    const sm = new TonRocks.ClassicWallets.WalletV3Contract({
        keys: keyPair
    });

    const smDeploy = await sm.deploy({
        wc: -1
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

async function testClassicTransact(address, keyPair, transactionNum)
{
    const sm = new TonRocks.ClassicWallets.WalletV3Contract({
        address: address.toString(false),
        keys: keyPair
    });

    const smSeqno = sm.methods.seqno();

    let smSeqnoLocalResult = await smSeqno.runLocal();
    console.log('smSeqnoLocalResult', smSeqnoLocalResult);
    assert(smSeqnoLocalResult === 1);

    let success = 0;
    for (let i = 0; i < transactionNum; i++) {
        
        const smTransfer = sm.methods.transfer({
            toAddress: giverAddress,
            amount: TonRocks.utils.toNano(1),
            seqno: smSeqnoLocalResult,
            payload: 'Hello',
            sendMode: 3,
        });

        const smTransferMessage = await smTransfer.getMessage();
        console.log('smTransferMessage', smTransferMessage);
        assert(smTransferMessage.messageBodyBase64);

        const smTransferFee = await smTransfer.estimateFee();
        console.log('smTransferFee', smTransferFee);
        assert(smTransferFee.totalAccountFees.gt(1000));

        const smTransferResult = await smTransfer.run();
        console.log('smTransferResult', i, smTransferResult);
        if (smTransferResult.ok) {
            success++;

            smSeqnoLocalResult = await smSeqno.runLocal();
            console.log('smSeqnoLocalResult', smSeqnoLocalResult);
            assert(smSeqnoLocalResult === success + 1);
        }
    }
    assert(success > 0);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);
    assert(smTransactionsAll.length === success + 2); // trans + initial + deploy

    return success;
}

async function testClassicGetMethods(address, transactions)
{
    address = new TonRocks.types.Address(address);

    const sm = new TonRocks.ClassicWallets.WalletV3Contract({
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

    const smSeqno = sm.methods.seqno();

    const smSeqnoLocalResult = await smSeqno.runLocal();
    console.log('smSeqnoLocalResult', smSeqnoLocalResult);
    assert(smSeqnoLocalResult === transactions + 1);
}

async function testElectorContract()
{
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

    let address = await testGetElectorAddr(blockAPI, blockId);

    const sm = new TonRocks.ClassicContracts.ElectorContract({
        address
    });

    const smActiveElectionId = sm.methods.active_election_id();

    const smActiveElectionIdLocalResult = await smActiveElectionId.runLocal();
    console.log('smActiveElectionIdLocalResult', smActiveElectionIdLocalResult);
    assert(smActiveElectionIdLocalResult === 0 || smActiveElectionIdLocalResult > Math.ceil(new Date().getTime() / 1000));

    const smParticipantList = sm.methods.participant_list();

    const smParticipantListLocalResult = await smParticipantList.runLocal();
    console.log('smParticipantListLocalResult', smParticipantListLocalResult);
    assert(typeof smParticipantListLocalResult === 'object');

    const smParticipantExtList = sm.methods.participant_list_extended();

    const smParticipantListExtLocalResult = await smParticipantExtList.runLocal();
    console.log('smParticipantListExtLocalResult', smParticipantListExtLocalResult);
    assert(typeof smParticipantListExtLocalResult === 'object');

    const smReturnedStake = sm.methods.compute_returned_stake();

    const smReturnedStakeLocalResult = await smReturnedStake.runLocal({
        input: ['0x76e271bc1833b405b5999614b0cbcedfb6918290019927ddd8f11e7f811996c7']
    });
    console.log('smReturnedStakeLocalResult', smReturnedStakeLocalResult.toString());
    //assert(smReturnedStakeLocalResult);
}


async function testClassicElector() {
    while (true) {
        await testElectorContract();

        await (new Promise(resolve => setTimeout(resolve, 5000)));
    }
}