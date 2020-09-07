const {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes, nacl} = require('../utils');
const {Address, Cell} = require('../types');
const {BlockParser} = require('../blockchain/BlockParser');
const {Contract} = require('./Contract');

/**
 * ABI abstract contract class
 */
class AbiContract extends Contract {
  /**
   * @param {{abiPackage: Object, keys:(Object|undefined), signCallback:(Function|undefined), address:(Address|string|undefined)}} params 
   * @param {Object} provider 
   * @param {Object} storage 
   * @param {Object} client 
   * @param {Object} config
   */
  constructor(params, provider, storage, client, config) {
    super(provider, storage, client, config);

    if (!this.client) throw Error('no tvm');
    if (!params.abiPackage) throw Error('no abi package');
    if (params.abiPackage['ABI version'] < 2) throw Error('too old abi');
    if (!params.keys && !params.address) throw Error('specify keys or address');

    this.abiPackage = params.abiPackage;
    
    this.keys = params.keys;
    this.address = params.address ? new Address(params.address) : undefined;
    this.signCallback = params.signCallback;

    /**
     * Creates deploy object
     * 
     * @param {{wc:(Object|undefined), header:(Object|undefined), input:(Object|undefined), init:(Object|undefined)}} params 
     * @returns {Promise<{getMessage:Function, getAddress:Function, estimateFee:Function, runLocal:Function, run:Function}>}
     */
    this.deploy = async (params = {}) => {
      if (!this.keys.publicKey) throw Error('no public key');
      let functionBlock;
      for (let m in this.abiPackage.abi.functions) {
        if (this.abiPackage.abi.functions[m].name === 'constructor') {
          functionBlock = this.abiPackage.abi.functions[m];
          break;
        }
      }

      if (!this.address) {
        const address = await this._getAddress({
          abi: this.abiPackage.abi,
          imageBase64: this.abiPackage.imageBase64,
          header: params.header || {},
          input: params.input || {},
          init: params.init || {},
          publicKey: this.keys.publicKey,
          workchainId: params.wc
        });
        this.address = new Address(address);
      }

      let getDeployMessage = async () => {
        return await this.getDeployMessage({
          abi: this.abiPackage.abi,
          imageBase64: this.abiPackage.imageBase64,
          header: params.header || {},
          input: params.input || {},
          init: params.init || {},
          keyPair: this.keys,
          signCallback: this.signCallback,
          workchainId: params.wc,
          address: this.address
        });
      };

      return {
        /**
         * Gets message to send
         * 
         * @returns {Promise<MessageInfo>}
         */
        getMessage: async () => {
          return await getDeployMessage();
        },
        /**
         * Gets contract address
         * 
         * @returns {Address}
         */
        getAddress: () => {
          return this.address;
        },
        /**
         * Estimates deploy fees
         * 
         * @returns {Promise<Fees>}
         */
        estimateFee: async () => {
          let msg = await getDeployMessage();
          return await this._estimateFee({
            messageBodyBase64: msg.messageBodyBase64,
            address: this.address,
            emulateBalance: true
          });
        },
        /**
         * Emulates deploy run
         * 
         * @returns {{account:Account, output:Object, fee:Fees}}
         */
        runLocal: async () => {
          let msg = await getDeployMessage();
          return await this._runMessageLocal({
            emulateBalance: true,
            address: this.address,
            abi: this.abiPackage.abi,
            functionName: 'constructor',
            messageBodyBase64: msg.messageBodyBase64,
            fullRun: true
          });
        },
        /**
         * Runs deploy
         * 
         * @param {{tryNum: number, totalTimeout: number}} p
         * @returns {Promise<{ok:boolean, sended:boolean, confirmed:boolean}>} ok - is message was successfully transacted, sended - is message was sended to network, confirmed - is message status was confirmed
         */
        run: async (p = {}) => {
          let res;
          let tryNum = p.tryNum || 3;
          for (let t = 0; t < tryNum; t++) {
            let msg = await getDeployMessage();
            res = await this._runMessage(msg, 'uninit', p.totalTimeout, this._checkAbiMessage);
            //console.log('run try', t, ': ', res);
            if (res.ok) {
              if (functionBlock && functionBlock.inputs && functionBlock.inputs.length > 0) {
                let inp = await this.decodeTransactionInput({
                  transaction: res.transaction,
                  abi: this.abiPackage.abi,
                  functionName: 'constructor'
                });
                res.input = inp ? inp.output : undefined;
              }
              if (functionBlock && functionBlock.outputs && functionBlock.outputs.length > 0) {
                let out = await this.decodeTransactionOutput({
                  transaction: res.transaction,
                  abi: this.abiPackage.abi,
                  functionName: 'constructor'
                });
                res.output = out ? out.output : undefined;
              }
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

    this.methos = {};
    for (let m in this.abiPackage.abi.functions) {
      let functionBlock = this.abiPackage.abi.functions[m];
      let functionName = functionBlock.name;

      /**
       * Creates method object
       * 
       * @param {{input: Object, header: Object}} params
       * @returns {Promise<{getMessage:Function, getAddress:Function, estimateFee:Function, runLocal:Function, run:Function}>}
      */
      this.methods[functionName] = (params = {}) => {
        
        let getMessage = async () => {
          return await this.getMessage({
            address: this.address,
            abi: this.abiPackage.abi,
            functionName: functionName,
            header: params.header || {},
            input: params.input || {},
            keyPair: this.keys,
            signCallback: this.signCallback
          });
        };

        return {
          /**
           * Gets message to send
           * 
           * @returns {Promise<MessageInfo>}
           */
          getMessage: getMessage,
          /**
           * Estimates run fees
           * 
           * @param {{account: Account, emulateBalance: boolean}} p
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
           * Emulates local run
           * 
           * @param {{account: Account, fullRun: boolean, emulateBalance: boolean}} p
           * @returns {{account:Account, output:Object, fee:Fees}}
           */
          runLocal: async (p = {}) => {
            let account;
            if (!p.account) {
              account = await this._getAccount();
              if (!account.ok) throw Error('Cannot get account state: ' + account.reason);
              account = await this._convertAccount(account);
            } else {
              account = p.account;
            }
            let msg = await getMessage();
            return await this._runMessageLocal({
              emulateBalance: p.emulateBalance || false,
              address: this.address,
              abi: this.abiPackage.abi,
              account,
              functionName,
              messageBodyBase64: msg.messageBodyBase64,
              fullRun: p.fullRun || false
            });
          },
          /**
           * Runs method
           * 
           * @param {{tryNum: number, totalTimeout: number}} p
           * @returns {Promise<{ok:boolean, sended:boolean, confirmed:boolean}>} ok - is message was successfully transacted, sended - is message was sended to network, confirmed - is message status was confirmed
           */
          run: async (p = {}) => {
            let res;
            let tryNum = p.tryNum || 3;

            for (let t = 0; t < tryNum; t++) {
              let msg = await getMessage();
              res = await this._runMessage(msg, 'active', p.totalTimeout, this._checkAbiMessage);
              //console.log('run try', t, ': ', res);

              if (res.ok) {
                if (functionBlock.inputs && functionBlock.inputs.length > 0) {
                  let inp = await this.decodeTransactionInput({
                    transaction: res.transaction,
                    abi: this.abiPackage.abi,
                    functionName
                  });
                  res.input = inp ? inp.output : undefined;
                }
                if (functionBlock.outputs && functionBlock.outputs.length > 0) {
                  let out = await this.decodeTransactionOutput({
                    transaction: res.transaction,
                    abi: this.abiPackage.abi,
                    functionName
                  });
                  res.output = out ? out.output : undefined;
                }
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
  }

  /**
   * @private
   * @param {{secretKey:Uint8Array, publicKey:Uint8Array}} keys 
   */
  _getKeys(keys) {
    return keys ? {
        secret: keys.secretKey ? bytesToHex(keys.secretKey.subarray(0, 32)) : undefined,
        public: keys.publicKey ? bytesToHex(keys.publicKey) : undefined
    } : undefined;
  }

  /**
   * @private
   * @param {Object} params 
   */
  async _getAddress(params) {
    if (!params.publicKey) throw Error('no public key');

    // only public key is required
    let publicKey = bytesToHex(params.publicKey);

    const messageUnsigned = await this.client.requestCore('contracts.deploy.encode_unsigned_message', {
      abi: params.abi,
      imageBase64: params.imageBase64,
      constructorHeader: params.header,
      constructorParams: params.input,
      initParams: params.init,
      publicKeyHex: publicKey,
      workchainId: params.workchainId
    });

    return messageUnsigned.addressHex;
  } 

  /**
   * Check message for ABI contracts
   * 
   * @private
   * @param {Message} message 
   * @param {BlockObject} inMsg 
   */
  _checkAbiMessage(message, inMsg) {
    if (inMsg._ !== 'Message')
      return false;

    if (!message.signed) {
      return message.hash === bytesToHex(inMsg.hash);
    }

    if(!inMsg.body)
      return false;

    let signature = BlockParser.parseSignature(inMsg.body);
    return message.sign === bytesToHex(signature);
  }

  async getDeployMessage(params) {
    if (!params.abi) throw Error('no abi');
    if (params.abi['ABI version'] < 2) throw Error('too old abi');

    if (params.abi.header.includes("pubkey") &&
        params.keyPair !== undefined &&
        params.keyPair.publicKey !== undefined) {
      params.header.pubkey = bytesToHex(params.keyPair.publicKey);
    }
    if (params.abi.header.includes("time")) {
      params.header.time = params.header.time || Date.now();
    }

    const signExist = !!params.signCallback || (params.keyPair && params.keyPair.secretKey);
    const externalSign = !!params.signCallback && (!params.keyPair || !params.keyPair.secretKey);
    const expiration = externalSign ? this.config.expireExtDefault : this.config.expireDefault;

    if (params.abi.header.includes("expire")) {
      params.header.expire = params.header.expire || Math.floor((Date.now() + expiration) / 1000);
    }

    if (signExist) {
      const messageUnsigned = await this.client.requestCore('contracts.deploy.encode_unsigned_message', {
        abi: params.abi,
        imageBase64: params.imageBase64,
        constructorHeader: params.header,
        constructorParams: params.input,
        initParams: params.init,
        publicKeyHex: bytesToHex(params.keyPair.publicKey),
        workchainId: params.workchainId
      });

      if (messageUnsigned.addressHex !== params.address.toString(false))
        throw Error('invalid deploy message');

      const bytesToSign = base64ToBytes(messageUnsigned.encoded.bytesToSignBase64);
      
      let sign;
      if (externalSign) {
        sign = params.signCallback('constructor', bytesToSign, params.address, params.keyPair, params.header);
      }
      else {
        sign = nacl.sign.detached(bytesToSign, params.keyPair.secretKey);
      }
      let signBase64 = bytesToBase64(sign);

      const messageSigned = await this.client.requestCore('contracts.encode_message_with_sign', {
        abi: params.abi,
        unsignedBytesBase64: messageUnsigned.encoded.unsignedBytesBase64,
        signBytesBase64: signBase64
      });

      return {
        messageBodyBase64: messageSigned.messageBodyBase64,
        expire: params.header.expire,
        signed: true,
        sign: bytesToHex(sign)
      };

    }
    else {
      throw Error("TODO make deploy without keys");
      /*
      let keyPair = this._getKeys(params.keyPair);
      const message = await this.client.requestCore('contracts.deploy.message', {
        abi: params.abi,
        imageBase64: params.imageBase64,
        constructorHeader: params.header,
        constructorParams: params.input,
        initParams: params.init,
        keyPair: keyPair,
        workchainId: params.workchainId
      });
      return  {
        messageBodyBase64: message.messageBodyBase64,
        expire: params.header.expire,
        signed: false,
        hash: bytesToHex(hexToBytes(message.messageId))
      };
      */
    }

    //params.keyPair = this._getKeys(params.keyPair);
    //const message = await this.client.requestCore('contracts.deploy.message', params);
    //return message;
  }

  /**
   * Creates ABI message
   * 
   * @param {Object} params
   * @returns {Promise<MessageInfo>}
   */
  async getMessage(params) {
    if (!params.address) throw Error('no address');
    if (!params.abi) throw Error('no abi');
    if (params.abi['ABI version'] < 2) throw Error('too old abi');

    if (params.abi.header.includes("pubkey") &&
        params.keyPair !== undefined &&
        params.keyPair.publicKey !== undefined) {
      params.header.pubkey = bytesToHex(params.keyPair.publicKey);
    }
    if (params.abi.header.includes("time")) {
      params.header.time = params.header.time || Date.now();
    }

    const signExist = !!params.signCallback || (params.keyPair && params.keyPair.secretKey);
    const externalSign = !!params.signCallback && (!params.keyPair || !params.keyPair.secretKey);
    const expiration = externalSign ? this.config.expireExtDefault : this.config.expireDefault;

    if (params.abi.header.includes("expire")) {
      params.header.expire = params.header.expire || Math.floor((Date.now() + expiration) / 1000);
    }

    let ret;
    if (signExist) {

      const messageUnsigned = await this.client.requestCore('contracts.run.encode_unsigned_message', {
        address: params.address.toString(false),
        abi: params.abi,
        functionName: params.functionName,
        header: params.header,
        input: params.input
      });

      const bytesToSign = base64ToBytes(messageUnsigned.bytesToSignBase64);
      
      let sign;
      if (externalSign) {
        sign = params.signCallback(params.functionName, bytesToSign, params.address, params.keyPair, params.header);
      }
      else {
        sign = nacl.sign.detached(bytesToSign, params.keyPair.secretKey);
      }
      let signBase64 = bytesToBase64(sign);

      const messageSigned = await this.client.requestCore('contracts.encode_message_with_sign', {
        abi: params.abi,
        unsignedBytesBase64: messageUnsigned.unsignedBytesBase64,
        signBytesBase64: signBase64
      });

      ret = {
        messageBodyBase64: messageSigned.messageBodyBase64,
        expire: params.header.expire,
        signed: true,
        sign: bytesToHex(sign)
      }
    }
    else {
      const message = await this.client.requestCore('contracts.run.message', {
        address: params.address.toString(false),
        abi: params.abi,
        functionName: params.functionName,
        header: params.header,
        input: params.input,
        keyPair: params.keyPair
      });
      ret = {
        messageBodyBase64: message.messageBodyBase64,
        expire: params.header.expire,
        signed: false,
        hash: bytesToHex(hexToBytes(message.messageId))
      }
    }

    return ret;
  }

  /**
   * Decodes input message
   * 
   * @param {Message | Cell | string} msg Message or Cell or Base64 BOC string
   * @param {Object} abi ABI package
   * @param {*} incomplete Is message returned by encode_unsigned_message
   * @param {string} functionName Search for functionName
   * @returns {Promise<{message: Cell, output: Object, function: string}>}
   */
  async decodeInput(msg, abi, incomplete=false, functionName) {
    if (typeof msg === 'string')
      msg = await Cell.fromBoc(base64ToBytes(msg));

    if (msg._ === 'Cell')
      msg = BlockParser.parseMessage(msg);

    if (msg._ !== 'Message') throw Error('not a Message');

    const internal = msg.info.type !== 'ext_in';

    let refs = msg.body.cell.refs.length - msg.body.current_ref;
    let len = msg.body.cell.bits.cursor - msg.body.current_pos;

    if (len === 0)
      return undefined;
    
    const bodyCell = new Cell();

    if (incomplete)
      bodyCell.bits.writeBit(false);
    
    for (let k = 0; k < len; k++) {
      bodyCell.bits.writeBit(msg.body.cell.bits.get(msg.body.current_pos + k));
    }
    for (let k = 0; k < refs; k++) {
      bodyCell.refs.push(msg.body.cell.refs[msg.body.current_ref + k]);
    }

    const msgBoc = bytesToBase64(await bodyCell.toBoc(false, false, false));

    const res = await this.client.requestCore('contracts.run.unknown.input', {
      abi: abi,
      bodyBase64: msgBoc,
      internal
    });

    if (res.function !== undefined && functionName !== undefined && res.function !== functionName) {
      console.warn('decodeTransactionInput invalid function:', res.function);
      return undefined;
    }

    return {
      message: msg,
      output: res.output,
      function: res.function
    };
  }

  /**
   * Decodes input message from transaction
   * 
   * @param {{transaction: Transaction, abi: Object, functionName: string}} params 
   * @returns {Promise<{message: Cell, output: Object, function: string}>}
   */
  async decodeTransactionInput(params) {
    if (!params.transaction) throw Error('no transaction');

    const msg = params.transaction.in_msg;
    try {
      let res = await this.decodeInput(msg, params.abi, false, params.functionName);
      if (res) return res;
    } catch (e) {
      console.log('decodeTransactionInput error', e);
    }

    return undefined;
  }

  /**
   * Decodes output message
   * 
   * @param {Message | Cell | string} msg Message or Cell or Base64 BOC string
   * @param {Object} abi ABI package
   * @param {string} functionName Search for functionName
   * @returns {Promise<{message: Cell, output: Object, function: string}>}
   */
  async decodeOutput(msg, abi, functionName) {
    if (typeof msg === 'string')
      msg = await Cell.fromBoc(base64ToBytes(msg));

    if (msg._ === 'Cell')
      msg = BlockParser.parseMessage(msg);

    if (msg._ !== 'Message') throw Error('not a Message');

    if (msg.info.type !== 'ext_out')
      return undefined;

    let refs = msg.body.cell.refs.length - msg.body.current_ref;
    let len = msg.body.cell.bits.cursor - msg.body.current_pos;

    if (len === 0)
      return undefined;
    
    const bodyCell = new Cell();
    for (let k = 0; k < len; k++) {
      bodyCell.bits.writeBit(msg.body.cell.bits.get(msg.body.current_pos + k));
    }
    for (let k = 0; k < refs; k++) {
      bodyCell.refs.push(msg.body.cell.refs[msg.body.current_ref + k]);
    }

    const msgBoc = bytesToBase64(await bodyCell.toBoc(false, false, false));

    const res = await this.client.requestCore('contracts.run.unknown.output', {
      abi: abi,
      bodyBase64: msgBoc,
      internal: false
    });

    if (res.function !== undefined && functionName !== undefined && res.function !== functionName) {
      console.warn('decodeTransactionOutput invalid function:', res.function);
      return undefined;
    }

    return {
      message: msg,
      output: res.output,
      function: res.function
    };
  }
  
  /**
   * Decodes output message from transaction
   * 
   * @todo Check multiply output
   * @param {{transaction: Transaction, abi: Object, functionName: string}} params 
   * @returns {Promise<{message: Cell, output: Object, function: string}>}
   */
  async decodeTransactionOutput(params) {
    if (!params.transaction) throw Error('no transaction');

    for (const entry of params.transaction.out_msgs.map.entries()) {
      const msg = entry[1];
      try {
        let res = await this.decodeOutput(msg, params.abi, params.functionName);
        if (res) return res;
      } catch (e) {
        console.log('decodeTransactionOutput error', e);
      }
    }

    return undefined;
  }

}


module.exports = {AbiContract};