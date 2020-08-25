
const SetcodeMultisigWalletAbi = require('./SetcodeMultisigWallet.abi.json');
const SetcodeMultisigWalletCode = require('./SetcodeMultisigWallet.tvc.json');
const SetcodeMultisigWallet = {
    abi: SetcodeMultisigWalletAbi,
    imageBase64: SetcodeMultisigWalletCode.code
};

const SafeMultisigWalletAbi = require('./SafeMultisigWallet.abi.json');
const SafeMultisigWalletCode = require('./SafeMultisigWallet.tvc.json');
const SafeMultisigWallet = {
    abi: SafeMultisigWalletAbi,
    imageBase64: SafeMultisigWalletCode.code
};

const GiverAbi = require('./Giver.abi.json');
const GiverCode = require('./Giver.tvc.json');
const Giver = {
    abi: GiverAbi,
    imageBase64: GiverCode.code
};


module.exports = {AbiPackages: {SetcodeMultisigWallet, SafeMultisigWallet, Giver}};