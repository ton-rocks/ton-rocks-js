var giverAddress = "0:9a66a943e121e1cdb8e09126d3d31a88ac1e4b6d391bc0718b39af36e8de372a";

async function testGiverDeploy()
{
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

    giverAddress = address.toString(false);

    return address;
}


async function testGiverGimme(address, amount)
{
    console.log('Asking giver for', amount, 'to', address.toString(false));

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.Giver,
        address: giverAddress
    });

    const smTransferToAddress = sm.methods.do_tvm_transfer({
        input: {"remote_addr": address.toString(false), "grams_value": amount, "bounce": false, "sendrawmsg_flag": 0},
        header: undefined
    });

    while (true) {
        const smTransferToAddressResult = await smTransferToAddress.run();
        console.log('smTransferToAddressResult', smTransferToAddressResult);
        if (smTransferToAddressResult.ok) {
            console.log('Giver was happy to help');
            break;
        }

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    const smAccount = await sm.getAccount();
    console.log('Giver balance:', TonRocks.utils.fromNano(smAccount.balance));
}
