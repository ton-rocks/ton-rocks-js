const {Address, Cell} = require("../../../types");
const {BN, bytesToHex, hexToBytes, nacl, stringToBytes, bytesToBase64} = require("../../../utils");
const {ClassicContract} = require("../../ClassicContract.js");

/**
 * Abstract standard wallet class
 */
class WalletContract extends ClassicContract {
    /**
     * @param {{code:(Uint8Array|undefined), address:(Address|string|undefined), wc:(number|undefined)}, keys:(Object|undefined), signCallback:(Function|undefined)} options
     * @param {Object} provider 
     * @param {Object} storage 
     * @param {Object} client 
     * @param {Object} config
     */
    constructor(options, provider, storage, client, config) {
        super(options, provider, storage, client, config);

        this.methods = {
            /**
             * New transfer object
             * 
             * @param {{keys:Object, toAddress:(Address|string), amount:(BN|number), seqno:number, payload:(string|Uint8Array), sendMode: number}} params 
             * @returns {{getMessage:Function, estimateFee:Function, run:Function}}
             */
            transfer: (params) => {

                const getMessage = async () => {
                    const query = await this.createTransferMessage(params.toAddress, params.amount, params.seqno, params.payload, params.sendMode);
                    const res = {
                        messageBodyBase64: bytesToBase64(await query.message.toBoc(false)),
                        sign: query.sign,
                        signed: query.signed,
                        hash: query.hash
                    }
                    return res;
                }

                return {
                    /**
                     * Gets message
                     * 
                     * @returns {Promise<Object>}
                     */
                    getMessage: async () => {
                        return await getMessage();
                    },
                    /**
                     * Estimates fees
                     * 
                     * @throws {Error}
                     * @param {{account:Account, emulateBalance:boolean}} p
                     * @returns {Promise<Fees>}
                     */
                    estimateFee: async (p = {}) => {
                        let account;
                        if (!p.account) {
                          account = await this._getAccount();
                          if (!account.ok) throw Error('Cannot get account state');
                          account = await this._convertAccount(account);
                        } else {
                          account = p.account;
                        }
                        let msg = await getMessage();
                        return await this._estimateFee({
                          messageBodyBase64: msg.messageBodyBase64,
                          address: this.address,
                          account,
                          emulateBalance: p.emulateBalance || false
                        });
                    },
                    /**
                     * Runs method in network
                     * 
                     * @param {{tryNum:number, totalTimeout:number}} p
                     * @returns {Promise<Object>}
                     */
                    run: async (p = {}) => {
                      let res;
                      let tryNum = p.tryNum || 3;
                      for (let t = 0; t < tryNum; t++) {
                        let msg = await getMessage();
                        res = await this._runMessage(msg, 'active', p.totalTimeout, this._checkStandartMessage);
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
            },
            /**
             * New seqno object
             * 
             * @returns {{runLocal:Function}}
             */
            seqno: () => {
                return {
                    /**
                     * Runs seqno get method
                     * 
                     * @return {Promise<number>}
                     */
                    runLocal: async (p={}) => {
                        const res = await this._runGetMethod('seqno', p);
                        return parseInt(res.output[0], 16);
                    }
                }
            }
        }
    }

    /**
     * @override
     * @private
     * @return {Cell} cell contains wallet data
     */
    createDataCell() {
        // 4 byte seqno, 32 byte publicKey
        const cell = new Cell();
        cell.bits.writeUint(0, 32); // seqno
        cell.bits.writeBytes(this.keys.publicKey);
        return cell;
    }

    /**
     * @override
     * @private
     * @param {number} seqno 
     * @return {Cell}
     */
    createSigningMessage(seqno) {
        seqno = seqno || 0;
        const cell = new Cell();
        cell.bits.writeUint(seqno, 32);
        return cell;
    }

    /**
     * @param {Address | string} address
     * @param {BN | number} amount in nanograms
     * @param {number} seqno
     * @param {string | Uint8Array} payload
     * @param {number} sendMode
     * @param {boolean} dummySignature  
     * @return {Promise<{address: Address, signature: Uint8Array, message: Cell, cell: Cell, body: Cell, resultMessage: Cell, hash: string, sign: string, signed: boolean}>}
     */
    async createTransferMessage(
        address,
        amount,
        seqno,
        payload = "",
        sendMode = 3,
        dummySignature = false
    ) {
        const payloadCell = new Cell();
        if (payload) {
            if (typeof payload === 'string') {
                if (payload.length > 0) {
                    payloadCell.bits.writeUint(0, 32);
                    payloadCell.bits.writeBytes(stringToBytes(payload));
                }
            } else {
                payloadCell.bits.writeBytes(payload)
            }
        }

        const signExist = !!this.signCallback || (this.keys && this.keys.secretKey);
        const externalSign = !!this.signCallback && (!this.keys || !this.keys.secretKey);
        if (!signExist) dummySignature = true;

        const orderHeader = ClassicContract.createInternalMessageHeader(new Address(address), new BN(amount));
        const order = ClassicContract.createMessage(orderHeader, null, payloadCell);
        const signingMessage = this.createSigningMessage(seqno);
        signingMessage.bits.writeUint8(sendMode);
        signingMessage.refs.push(order);
        await signingMessage.finalizeTree();
        const signingMessageHash = signingMessage.getHash(0);

        const selfAddress = await this.getAddress();

        let sign;
        if (dummySignature) {
            sign = new Uint8Array(64);
        }
        else if (externalSign) {
            sign = this.signCallback('transfer', signingMessageHash, this.address, this.keys);
        }
        else {
            sign = nacl.sign.detached(signingMessageHash, this.keys.secretKey);
        }

        //const signature = dummySignature ? new Uint8Array(64) : nacl.sign.detached(await signingMessage.hash(), secretKey);
        const body = new Cell();
        body.bits.writeBytes(sign);
        body.writeCell(signingMessage);

        const header = ClassicContract.createExternalMessageHeader(selfAddress);

        const resultMessage = ClassicContract.createMessage(header, null, body);

        let res = {
            address: selfAddress,
            message: resultMessage, // old wallet_send_generate_external_message

            body: body,
            signature: sign,
            signingMessage: signingMessage,
        };

        if (dummySignature) {
            await resultMessage.finalizeTree();
            res.hash = bytesToHex(resultMessage.getHash(0));
            res.signed = false;
        }
        else {
            res.sign = bytesToHex(sign);
            res.signed = true;
        }

        return res;
    }
}

class SimpleWalletContract extends WalletContract {
    /**
     * @param {{address:(Address|string|undefined), wc:(number|undefined)}, keys:(Object|undefined), signCallback:(Function|undefined)} options
     * @param {Object} provider 
     * @param {Object} storage 
     * @param {Object} client 
     * @param {Object} config
     */
    constructor(options, provider, storage, client, config) {
        options.code = hexToBytes("FF0020DDA4F260810200D71820D70B1FED44D0D31FD3FFD15112BAF2A122F901541044F910F2A2F80001D31F3120D74A96D307D402FB00DED1A4C8CB1FCBFFC9ED54");
        super(options, provider, storage, client, config);
    }
}

class StandardWalletContract extends WalletContract {
    /**
     * @param {{address:(Address|string|undefined), wc:(number|undefined)}, keys:(Object|undefined), signCallback:(Function|undefined)} options
     * @param {Object} provider 
     * @param {Object} storage 
     * @param {Object} client 
     * @param {Object} config
     */
    constructor(options, provider, storage, client, config) {
        options.code = hexToBytes("FF0020DD2082014C97BA9730ED44D0D70B1FE0A4F260810200D71820D70B1FED44D0D31FD3FFD15112BAF2A122F901541044F910F2A2F80001D31F3120D74A96D307D402FB00DED1A4C8CB1FCBFFC9ED54");
        super(options, provider, storage, client, config);
    }
}

class WalletV3Contract extends WalletContract {
    /**
     * @param {{address:(Address|string|undefined), wc:(number|undefined)}, keys:(Object|undefined), signCallback:(Function|undefined)} options
     * @param {Object} provider 
     * @param {Object} storage 
     * @param {Object} client 
     * @param {Object} config
     */
    constructor(options, provider, storage, client, config) {
        options.code = hexToBytes("FF0020DD2082014C97BA9730ED44D0D70B1FE0A4F2608308D71820D31FD31FD31FF82313BBF263ED44D0D31FD31FD3FFD15132BAF2A15144BAF2A204F901541055F910F2A3F8009320D74A96D307D402FB00E8D101A4C8CB1FCB1FCBFFC9ED54");
        if (!options.walletId) options.walletId = 698983191;
        super(options, provider, storage, client, config);
    }

    /**
     * @override
     * @private
     * @param {number} seqno 
     * @return {Cell}
     */
    createSigningMessage(seqno) {
        seqno = seqno || 0;
        const message = new Cell();
        message.bits.writeUint(this.options.walletId, 32);
        if (seqno === 0) {
            // message.bits.writeInt(-1, 32);// todo: dont work
            for (let i = 0; i < 32; i++) {
                message.bits.writeBit(1);
            }
        } else {
            const date = new Date();
            const timestamp = Math.floor(date.getTime() / 1e3);
            message.bits.writeUint(timestamp + 60, 32);
        }
        message.bits.writeUint(seqno, 32);
        return message;
    }

    /**
     * @override
     * @return {Cell} cell contains wallet data
     */
    createDataCell() {
        const cell = new Cell();
        cell.bits.writeUint(0, 32);
        cell.bits.writeUint(this.options.walletId, 32);
        cell.bits.writeBytes(this.keys.publicKey);
        return cell;
    }
}


module.exports = {SimpleWalletContract, StandardWalletContract, WalletV3Contract};