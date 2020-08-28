const {Address, Cell} = require("../../../types");
const {BN, toNano, bytesToHex, hexToBytes, nacl, stringToBytes, bytesToBase64} = require("../../../utils");
const {ClassicContract} = require("../../ClassicContract.js");

/**
 * Abstract standard wallet class
 */
class WalletContract extends ClassicContract {
    /**
     * @param provider    {HttpProvider}
     * @param options?    {{code: Uint8Array, publicKey?: Uint8Array, address?: Address | string, wc?: number}}
     */
    constructor(options, provider) {
        //if (!options.publicKey && !options.address) throw new Error('WalletContract required publicKey or address in options')
        super(options, provider);

        this.methods = {
            /**
             * @param   params {{secretKey: Uint8Array, toAddress: Address | string, amount: BN | number, seqno: number, payload: string | Uint8Array, sendMode: number}}
             */
            transfer: (params) => {

                const getMessage = async () => {
                    const query = await this.createTransferMessage(this.keys.secretKey, params.toAddress, params.amount, params.seqno, params.payload, params.sendMode);
                    const res = {
                        messageBodyBase64: bytesToBase64(await query.message.toBoc(false)),
                        sign: query.sign,
                        signed: query.signed
                    }
                    return res;
                }

                return {
                    getMessage: async () => {
                        return await getMessage();
                    },
                    /*
                    account
                    emulateBalance
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
                    /*
                    tryNum
                    totalTimeout (UTC time in seconds)
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
            seqno: () => {
                return {
                    /**
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
     * @param   seqno?   {number}
     * @return {Cell}
     */
    createSigningMessage(seqno) {
        seqno = seqno || 0;
        const cell = new Cell();
        cell.bits.writeUint(seqno, 32);
        return cell;
    }

    /**
     * @param secretKey {Uint8Array}  nacl.KeyPair.secretKey
     * @param address   {Address | string}
     * @param amount    {BN | number} in nanograms
     * @param seqno {number}
     * @param payload   {string | Uint8Array}
     * @param sendMode?  {number}
     * @param dummySignature?    {boolean}
     * @return {Promise<{address: Address, signature: Uint8Array, message: Cell, cell: Cell, body: Cell, resultMessage: Cell}>}
     */
    async createTransferMessage(
        secretKey,
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
            sign = params.signCallback('transfer', signingMessageHash, this.address, this.keys);
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
            res.sign = bytesToHex(resultMessage.getHash(0));
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
     * @param provider    {HttpProvider}
     * @param options? {any}
     */
    constructor(options, provider) {
        options.code = hexToBytes("FF0020DDA4F260810200D71820D70B1FED44D0D31FD3FFD15112BAF2A122F901541044F910F2A2F80001D31F3120D74A96D307D402FB00DED1A4C8CB1FCBFFC9ED54");
        super(options, provider);
    }
}

class StandardWalletContract extends WalletContract {
    /**
     * @param provider    {HttpProvider}
     * @param options? {any}
     */
    constructor(options, provider) {
        options.code = hexToBytes("FF0020DD2082014C97BA9730ED44D0D70B1FE0A4F260810200D71820D70B1FED44D0D31FD3FFD15112BAF2A122F901541044F910F2A2F80001D31F3120D74A96D307D402FB00DED1A4C8CB1FCBFFC9ED54");
        super(options, provider);
    }
}

class WalletV3Contract extends WalletContract {
    /**
     * @param provider    {HttpProvider}
     * @param options? {any}
     */
    constructor(options, provider) {
        options.code = hexToBytes("FF0020DD2082014C97BA9730ED44D0D70B1FE0A4F2608308D71820D31FD31FD31FF82313BBF263ED44D0D31FD31FD3FFD15132BAF2A15144BAF2A204F901541055F910F2A3F8009320D74A96D307D402FB00E8D101A4C8CB1FCB1FCBFFC9ED54");
        if (!options.walletId) options.walletId = 698983191;
        super(options, provider);
    }

    /**
     * @override
     * @private
     * @param   seqno?   {number}
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

//There are two versions of standart wallet for now (14.01.2020):
//simple-wallet-code.fc and wallet-code.fc (the one with seqno() method)
class ClassicWallet {
    /**
     * @param provider    {HttpProvider}
     */
    constructor(provider) {
        this.provider = provider;
        this.all = {SimpleWalletContract, StandardWalletContract, WalletV3Contract};
        this.default = WalletV3Contract;
    }

    create(options) {
        return new this.default(this.provider, options);
    }
}

module.exports = {SimpleWalletContract, StandardWalletContract, WalletV3Contract};