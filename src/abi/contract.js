const { TONClient, setWasmOptions } = require('ton-client-web-js');
const {Block} = require('../blockchain/Block');


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


module.exports = {EmbeddedAbiContracts: {SetcodeMultisigWallet, SafeMultisigWallet}};