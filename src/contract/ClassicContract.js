const {Cell, Address} = require("../types");
const {bytesToBase64, bytesToHex, nacl} = require("../utils");
const {BlockParser} = require('../blockchain/BlockParser');
const {Contract} = require('./Contract');

class ClassicContract extends Contract {
    /**
     * @param {{code:(Uint8Array|undefined), address:(Address|undefined), wc:(number|undefined), keys:(Object|undefined), signCallback:(Function|undefined)} options
     * @param {Object} provider 
     * @param {Object} storage 
     * @param {Object} client 
     * @param {Object} config
     */
    constructor(options, provider, storage, client, config) {
        super(provider, storage, client, config);
        this.options = options;
        this.address = options.address ? new Address(options.address) : null;
        if (!options.wc) options.wc = this.address ? this.address.wc : 0; // TODO wc
        this.methods = {};

        this.keys = options.keys;
        this.signCallback = options.signCallback;

        /**
         * @param secretKey {Uint8Array}
         */
        this.deploy = async (params = {}) => {
            if (!this.keys.publicKey) throw Error('no public key');
            params.wc = params.wc !== undefined ? params.wc : 0;
            this.options.wc = this.address ? this.address.wc : params.wc;

            if (!this.address) {
                const address = await this._getAddress();
                this.address = new Address(address);
            }

            const getDeployMessage = async () => {
                const query = await this.createInitExternalMessage();
                const res = {
                    messageBodyBase64: bytesToBase64(await query.message.toBoc(false)),
                    sign: query.sign,
                    signed: query.signed,
                    hash: query.hash
                }
                return res;
            }

            return {
                /*
                */
                getMessage: async () => {
                  return await getDeployMessage();
                },
                /*
                */
                getAddress: () => {
                  return this.address;
                },
                /*
                */
                estimateFee: async () => {
                  let msg = await getDeployMessage();
                  return await this._estimateFee({
                    messageBodyBase64: msg.messageBodyBase64,
                    address: this.address,
                    emulateBalance: true
                  });
                },
                /*
                tryNum
                totalTimeout (UTC time in seconds)
                */
                run: async (p = {}) => {
                  let res;
                  let tryNum = p.tryNum || 3;
                  for (let t = 0; t < tryNum; t++) {
                    let msg = await getDeployMessage();
                    res = await this._runMessage(msg, 'uninit', p.totalTimeout, this._checkStandartMessage);
                    //console.log('run try', t, ': ', res);
                    if (res.ok) {
                      return res;
                    }
                    if (!res.sended)
                      continue;
                    if (!res.confirmed)
                      return res;
                  }
                  return res;
                },
            }
        }
    }

    /**
     * @return {Promise<Address>}
     */
    async _getAddress() {
        return (await this.createStateInit()).address;
    }

    async _runGetMethod(functionName, p={}) {
        let account;
        if (!p.account) {
          account = await this._getAccount();
          if (!account.ok) throw Error('Cannot get account state: ' + account.reason);
          account = await this._convertAccount(account);
        } else {
          account = p.account;
        }
        return await this._runGet(account, functionName, p.input);
    }

    /**
     * @private
     * @return {Cell} cell contains wallet code
     */
    createCodeCell() {
        if (!this.options.code) throw new Error('Contract: options.code is not defined')
        const cell = new Cell();
        cell.bits.writeBytes(this.options.code);
        return cell;
    }

    /**
     * Method to override
     * @protected
     * @return {Cell} cell contains wallet data
     */
    createDataCell() {
        return new Cell();
    }

    /**
     * Method to override
     * @protected
     * @param  options?
     * @return {Cell} cell contains message data
     */
    // eslint-disable-next-line no-unused-vars
    createSigningMessage(options) {
        return new Cell();
    }

    /**
     * @private
     * @return {{stateInit: Cell, address: Address, code: Cell, data: Cell}}
     */
    async createStateInit() {
        const codeCell = this.createCodeCell();
        const dataCell = this.createDataCell();
        const stateInit = ClassicContract.createStateInit(codeCell, dataCell);
        await stateInit.finalizeTree();
        const stateInitHash = stateInit.getHash(0);
        const address = new Address(this.options.wc + ":" + bytesToHex(stateInitHash));
        return {
            stateInit: stateInit,
            address: address,
            code: codeCell,
            data: dataCell,
        }
    }

    /**
     * External message for initialization
     * @param secretKey  {Uint8Array} nacl.KeyPair.secretKey
     * @return {{address: Address, message: Cell, body: Cell, sateInit: Cell, code: Cell, data: Cell}}
     */
    async createInitExternalMessage() {

        const signExist = !!this.signCallback || (this.keys && this.keys.secretKey);
        const externalSign = !!this.signCallback && (!this.keys || !this.keys.secretKey);
        if (!signExist) throw Error('no sign methods');

        const {stateInit, address, code, data} = await this.createStateInit();

        const signingMessage = this.createSigningMessage();
        await signingMessage.finalizeTree();
        const signingMessageHash = signingMessage.getHash(0);

        let sign;
        if (externalSign) {
            sign = this.signCallback('deploy', signingMessageHash, this.address, this.keys);
        }
        else {
            sign = nacl.sign.detached(signingMessageHash, this.keys.secretKey);
        }

        const body = new Cell();
        body.bits.writeBytes(sign);
        body.writeCell(signingMessage);

        const header = ClassicContract.createExternalMessageHeader(address);
        const externalMessage = ClassicContract.createMessage(header, stateInit, body);

        //await externalMessage.finalizeTree();
        //let messageHash = externalMessage.getHash(0);

        return {
            address: address,
            message: externalMessage,
            sign: bytesToHex(sign),
            signed: true,

            body,
            signingMessage,
            stateInit,
            code,
            data,
        };
    }


    _checkStandartMessage(message, inMsg) {
        if (inMsg._ !== 'Message')
          return false;

        if (!message.signed) {
          return message.hash === bytesToHex(inMsg.hash);
        }

        if(!inMsg.body)
          return false;

        let signature = BlockParser.parseSignatureClassic(inMsg.body);
        return message.sign === bytesToHex(signature);
    }


    // _ split_depth:(Maybe (## 5)) special:(Maybe TickTock)
    // code:(Maybe ^Cell) data:(Maybe ^Cell)
    // library:(Maybe ^Cell) = StateInit;
    /**
     * @param code  {Cell}
     * @param data  {Cell}
     * @param library {null}
     * @param splitDepth {null}
     * @param ticktock  {null}
     * @return {Cell}
     */
    static createStateInit(code,
                           data,
                           library = null,
                           splitDepth = null,
                           ticktock = null) {
        if (library)
            throw "Library in state init is not implemented";
        if (splitDepth)
            throw "Split depth in state init is not implemented";
        if (ticktock)
            throw "Ticktock in state init is not implemented";

        const stateInit = new Cell();

        stateInit.bits.writeBitArray([Boolean(splitDepth), Boolean(ticktock), Boolean(code), Boolean(data), Boolean(library)]);
        if (code)
            stateInit.refs.push(code);
        if (data)
            stateInit.refs.push(data);
        if (library)
            stateInit.refs.push(library);
        return stateInit;
    }

    // extra_currencies$_ dict:(HashmapE 32 (VarUInteger 32))
    // = ExtraCurrencyCollection;
    // currencies$_ grams:Grams other:ExtraCurrencyCollection
    // = CurrencyCollection;

    //int_msg_info$0 ihr_disabled:Bool bounce:Bool
    //src:MsgAddressInt dest:MsgAddressInt
    //value:CurrencyCollection ihr_fee:Grams fwd_fee:Grams
    //created_lt:uint64 created_at:uint32 = CommonMsgInfo;
    /**
     * @param dest  {Address | string}
     * @param gramValue  {number | BN}
     * @param ihrDisabled  {boolean}
     * @param bounce  {null | boolean}
     * @param bounced {boolean}
     * @param src  {Address | string}
     * @param currencyCollection  {null}
     * @param ihrFees  {number | BN}
     * @param fwdFees  {number | BN}
     * @param createdLt  {number | BN}
     * @param createdAt  {number | BN}
     * @return {Cell}
     */
    static createInternalMessageHeader(dest,
                                       gramValue = 0,
                                       ihrDisabled = true,
                                       bounce = null,
                                       bounced = false,
                                       src = null,
                                       currencyCollection = null,
                                       ihrFees = 0,
                                       fwdFees = 0,
                                       createdLt = 0,
                                       createdAt = 0) {
        const message = new Cell();
        message.bits.writeBit(false);
        message.bits.writeBit(ihrDisabled);
        if (!(bounce === null)) {
            message.bits.writeBit(bounce);
        } else {
            message.bits.writeBit((new Address(dest)).isBounceable);
        }
        message.bits.writeBit(bounced);
        message.bits.writeAddress(src ? new Address(src) : null);
        message.bits.writeAddress(new Address(dest));
        message.bits.writeGrams(gramValue);
        if (currencyCollection) {
            throw "Currency collections are not implemented yet";
        }
        message.bits.writeBit(Boolean(currencyCollection));
        message.bits.writeGrams(ihrFees);
        message.bits.writeGrams(fwdFees);
        message.bits.writeUint(createdLt, 64);
        message.bits.writeUint(createdAt, 32);
        return message;
    }

    //ext_in_msg_info$10 src:MsgAddressExt dest:MsgAddressInt
    //import_fee:Grams = CommonMsgInfo;
    /**
     * @param dest  {Address | string}
     * @param src  {Address | string}
     * @param importFee  {number | BN}
     * @return {Cell}
     */
    static createExternalMessageHeader(dest,
                                       src = null,
                                       importFee = 0) {
        const message = new Cell();
        message.bits.writeUint(2, 2);
        message.bits.writeAddress(src ? new Address(src) : null);
        message.bits.writeAddress(new Address(dest));   // TODO, MsgAddressInt
        message.bits.writeGrams(importFee);
        return message;
    }

    //tblkch.pdf, page 57
    /*
    message$_ {X:Type} info:CommonMsgInfo
      init:(Maybe (Either StateInit ^StateInit))
      body:(Either X ^X) = Message X;
    */
    /**
     * Create Message contains header, stateInit, body
     * @param header {Cell}
     * @param stateInit?  {Cell}
     * @param body?  {Cell}
     * @return {Cell}
     */
    static createMessage(header, stateInit = null, body = null) {
        const commonMsgInfo = new Cell();
        commonMsgInfo.writeCell(header);

        if (stateInit) {
            commonMsgInfo.bits.writeBit(true);
            //-1:  need at least one bit for body
            // TODO we also should check for free refs here
            if (commonMsgInfo.bits.getFreeBits() - 1 >= stateInit.bits.getUsedBits()) {
                commonMsgInfo.bits.writeBit(false);
                commonMsgInfo.writeCell(stateInit);
            } else {
                commonMsgInfo.bits.writeBit(true);
                commonMsgInfo.refs.push(stateInit);
            }
        } else {
            commonMsgInfo.bits.writeBit(false);
        }
        // TODO we also should check for free refs here
        if (body) {
            if (commonMsgInfo.bits.getFreeBits() >= body.bits.getUsedBits()) {
                commonMsgInfo.bits.writeBit(false);
                commonMsgInfo.writeCell(body);
            } else {
                commonMsgInfo.bits.writeBit(true);
                commonMsgInfo.refs.push(body);
            }
        } else {
            commonMsgInfo.bits.writeBit(false);
        }
        return commonMsgInfo;
    }

    static arrayFromCONS(cons) {
        let result = [];
        let item = cons;

        while (item) {
            if (!item.length === 2) {
                return result;
            }

            result.push(item[0]);
            item = item[1];
        }

        return result;
    }
}


module.exports = {ClassicContract};