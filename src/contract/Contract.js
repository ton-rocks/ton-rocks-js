const {stringToBytes, bytesToString, bytesToBase64, base64ToBytes, bytesToHex, BN, compareBytes} = require('../utils');
const {Address, Cell} = require('../types');
const {Block} = require('../blockchain/Block');
const {TvmClient, setWasmOptions} = require('../tvm/nodejs/TvmClient.js');

const AccountType =
{
  none: -1,
  uninit: 0,
  active: 1,
  frozen: 2,
}

const MessageType =
{
  int: 0,
  ext_in: 1,
  ext_out: 2
}

const TransactionType =
{
  ord: 0,
  storage: 1,
  tick_tock: 2
}

/**
 * BlockAPI raw abstract type    <br>
 * 
 *   interface BlockObject {    <br>
 *    _: string;    <br>
 *    cell?: Cell;    <br>
 *    hash?: Uint8Array;      <br>
 *  }    <br>
 * 
 * @typedef {Object} BlockObject
 * @property {string} _ Object type string
 * @property {Cell} cell
 * @property {Uint8Array} hash
 */

/**
 * Account type    <br>
 * 
 *  interface Account {    <br>
 *    type: AccountType;    <br>
 *    code?: string; // base64    <br>
 *    data?: string; // base64    <br>
 *    balance: BN;    <br>
 *    balance_other?: any;    <br>
 *    id: string; // address in hex    <br>
 *    address: Address;    <br>
 *    state_hash?: Uint8Array;    <br>
 *    last_trans_id?: TransactionId;    <br>
 *    last_paid?: number;    <br>
 *    raw?: BlockObject;    <br>
 *  }    <br>
 * 
 * @typedef {Object} Account
 * @property {AccountType} type Account type
 * @property {string} code Account code in base64 format
 * @property {string} data Account data in base64 format
 * @property {BN} balance Current balance
 * @property {any} balance_other Other balance
 * @property {string} id Address in hex format
 * @property {Address} address Account address
 * @property {Uint8Array} state_hash Hash of current state 
 * @property {TransactionId} last_trans_id Last transaction id
 * @property {number} last_paid Time of last paid
 * @property {BlockObject} raw Account in raw format
 */

/**
 * Message type    <br>
 * 
 *  interface Message {    <br>
 *    raw: BlockObject;    <br>
 *    id: string; // hash in hex    <br>
 *    hash: Uint8Array;    <br>
 *    type: MessageType;    <br>
 *    src: Address;    <br>
 *    dst: Address;    <br>
 *    bounce?: bool;    <br>
 *    bounced?: bool;    <br>
 *    value?: BN;    <br>
 *    created_at?: number;    <br>
 *    created_lt?: BN;    <br>
 *    code?: string; // base64    <br>
 *    data?: string; // base64    <br>
 *    body?: string; // base64    <br>
 *  }    <br>
 * 
 * @typedef {Object} Message
 * @property {BlockObject} raw MEssage in raw format
 * @property {string} id Message hash in hex format
 * @property {Uint8Array} hash Message hash
 * @property {MessageType} type Message type
 * @property {Address} src Sourse address
 * @property {Address} dst Destination address
 * @property {boolean} bounce Bounce option
 * @property {boolean} bounced Is message bounced
 * @property {BN} value Value in message
 * @property {number} created_at Unix time of message creation
 * @property {BN} created_lt Logical time of message creation
 * @property {string} code Message code in base64 format (if included)
 * @property {string} data Message data in base64 format (if included)
 * @property {string} body Message body in base64 format
 */

/**
 * Transaction id type    <br>
 * 
 * interface TransactionId {    <br>
 *   id: string;    <br>
 *   lt: BN;    <br>
 *   hash: Uint8Array;    <br>
 * }    <br>
 * 
 * @typedef {Object} TransactionId
 * @property {string} id Transaction id
 * @property {BN} lt Logical time
 * @property {Uint8Array} hash Representation hash
 */

/**
 * Transaction type    <br>
 * 
 *  interface Transaction {    <br>
 *    id: string;   <br>
 *    hash: Uint8Array;    <br>
 *    
 *    type: TransactionType;    <br>
 * 
 *    lt: BN;    <br>
 *    now: number;    <br>
 *    prev_trans_id: TransactionId;    <br>
 *    total_fees: BN;    <br>
 *    
 *    orig_status: AccountType;    <br>
 *    end_status: AccountType;    <br>
 *    
 *    in_msg: Message;    <br>
 *    out_msgs: [Message];    <br>
 * 
 *    aborted?: bool;    <br>
 *    destroyed?: bool;    <br>
 * 
 *    old_hash: Uint8Array;    <br>
 *    new_hash: Uint8Array;    <br>
 * 
 *    workchain_id: number;    <br>
 *    account_addr: Address;    <br>
 *    account_id: string; // address in hex    <br>
 *    block_id: BlockId;    <br>
 *  }    <br>
 * 
 * @typedef {Object} Transaction
 * @property {string} id Transaction id
 * @property {Uint8Array} hash Hash
 * @property {TransactionType} type Transaction type
 * @property {BN} lt Logical time
 * @property {number} now Unix time
 * @property {TransactionId} prev_trans_id Previous transaction id
 * @property {BN} total_fees Transaction total fees
 * @property {AccountType} orig_status Account type before transaction
 * @property {AccountType} end_status Account type after transaction
 * @property {Message} in_msg Inbound message
 * @property {Object} out_msgs Outbound messages
 * @property {boolean} aborted Is transaction aborted
 * @property {boolean} destroyed
 * @property {Uint8Array} old_hash Acoount state hash before transaction 
 * @property {Uint8Array} new_hash Account state hash after transaction
 * @property {number} workchain_id Workchain id
 * @property {Address} account_addr Account address
 * @property {string} account_id Account address in hex format
 * @property {BlockId} block_id Block id of transaction
 */

/**
 * Fees type
 * 
 * @typedef {Fees}
 * @property {BN} gasFee
 * @property {BN} inMsgFwdFee
 * @property {BN} outMsgsFwdFee
 * @property {BN} storageFee
 * @property {BN} totalAccountFees
 * @property {BN} totalOutput
 */

 /**
  * MessageInfo type
  * 
  * @typedef {MessageInfo}
  * @property {string} messageBodyBase64
  * @property {number} expire
  * @property {boolean} signed
  * @property {string} sign Message sign in hex format (when signed=true)
  * @property {string} hash Message hash in hex format (when signed=false)
  */

/**
 * Abstract contract class
 */
class Contract {

  static get AccountType() {
    return AccountType;
  }

  static get MessageType() {
    return MessageType;
  }

  static get TransactionType() {
    return TransactionType;
  }

  /**
   * Creates base contract class
   * 
   * @param {Object} provider 
   * @param {Object} storage 
   * @param {Object} client 
   * @param {Object} config
   */
  constructor(provider, storage, client, config) {
    this.provider = provider || Contract._provider;
    this.client = client || Contract._client;
    this.methods = {};

    // Block api object
    this.block = new Block(provider, storage);

    this.bigBalance = '0x10000000000000';

    this.config = config || {
      sendTryCount: 10,
      queryTryCount: 10,
      expireDefault: 10000,
      expireExtDefault: 60000,
      syncMaxDiff: 30,
      runTimeout: 60000
    }
  }

  /**
   * @private
   * @param {string} msg 
   */
  static debugLog(msg) {
    console.log(msg);
  }

  /**
   * Initializes wasm TVM
   * 
   * @returns {Promise}
   */
  static async init() {
    if (Contract._client)
      return;

    if (setWasmOptions !== undefined) {
      setWasmOptions({
          debugLog: Contract.debugLog
      });
    }

    Contract._client = new TvmClient();
    await Contract._client.getCoreBridge();
  }

  /**
   * Sends message to TON network
   * 
   * @param {Object} message The message object
   */
  async sendMessage(message) {
    let sendRes;
    for (let j = 0; j < this.config.sendTryCount; j++) {
      sendRes = await this.block.sendMessage(message.messageBodyBase64);
      //console.log('sendRes', sendRes);
      if (sendRes && sendRes.ok)
        break;
    }
    return sendRes;
  }

  /**
   * Loads transaction list
   * 
   * @throws {Error} Error description
   * @param {TransactionId} from From transaction
   * @param {TransactionId} to To transaction (not including)
   * @param {number} limit Limit number
   * @returns {Object} [Transaction]
   */
  async getTransactions(from=undefined, to=undefined, limit=Number.MAX_VALUE) {
    if (!this.address) throw Error('no account address');

    if (!from) {
      let account = await this._getAccount();
      if (!account.ok) throw Error('cannot get account state: ' + account.reason);
      account = await this._convertAccount(account);
      from = account.last_trans_id;
      if (account.type === AccountType.none || from.lt.eq(new BN(0))) {
        return [];
      }
    }
    
    for (let i = 0; i < this.config.queryTryCount; i++) {
      let transRes = await this.block.getTransactions(limit,
                              this.address,
                              from.lt, from.hash,
                              to ? to.lt : undefined);
      if (!transRes.ok) {
        continue;
      }
      let transactions = [];
      for (let t in transRes.transactionList) {
        const transaction = transRes.transactionList[t];
        const blockId = transRes.blockIdList[t];
        let _trans = await this._convertTransaction(transaction, blockId);
        transactions.push(_trans);
      }
      return transactions;
    }

    throw Error('Cannot get transactions');
  }

  /**
   * Gets raw account state
   * 
   * @private
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), account:(Object|undefined), blockHeader:(Object|undefined), shardState:(Object|undefined), lastTransHash:(Uint32Array|undefined), lastTransLt:(BN|undefined)}>} 
   */
  async _getAccount() {
    let account;
    let reason;
    for (let i = 0; i < this.config.queryTryCount; i++) {
      try {
        // get latest block
        const blockId = await this.block.getLatestId();
        //console.log('latestBlockId', blockId);
        if (!blockId.ok)
          throw Error('Cannot get latest block: ' + blockId.reason);

        // check sync status
        if (Math.abs(blockId.serverDiff) > this.config.syncMaxDiff ||
          Math.abs(blockId.tonDiff) > this.config.syncMaxDiff)
          throw Error('Out of sync');

        // validate block
        const validRes = await this.block.validate(blockId.id);
        if (!validRes.ok)
          throw Error('Cannot validate latest block: ' + validRes.reason);
        if (!validRes.valid)
          throw Error('Latest block not valid');

        // get account state
        account = await this.block.getAccountState(blockId.id, this.address);
        //console.log('account', account);
        if (!account.ok) 
          throw Error('Cannot get account state: ' + account.reason);

        break;
      } catch (e) {
        console.log('Exception while _getAccount (will retry ' + (this.config.queryTryCount - i - 1) + ' times):', e);
        reason = e.toString();
      }
    }

    if (account === undefined || !account.ok)
      account = {
        ok: false,
        reason
      }

    return account;
  }

  /**
   * Gets account current state
   * 
   * @throws {Error}
   * @returns {Promise<Account>}
   */
  async getAccount() {
    if (!this.address) throw Error('no account address');

    const a = await this._getAccount();
    if (!a.ok) throw Error('Cannot get account state: ' + a.reason);

    // convert
    return await this._convertAccount(a);
  }

  /**
   * Gets account current state (without throw)
   * 
   * @returns {Promise<{ok:boolean, reason:(string|undefined), account:(Account|undefined)}>}
   */
  async getAccountNoThrow() {
    try {
      const account = await this.getAccount();
      return {
        ok: true,
        account
      };
    } catch (e) {
      return {
        ok: false,
        reason: e.toString()
      }
    }
  }

  getAddress() {
    return this.address;
  }

  /**
   * Converts from raw account to account
   * 
   * @private
   */
  async _convertAccount(account) {
    let _account = {};
    _account.raw = account.account;

    if (account.account.type === 'none') {
      _account.type = AccountType.none;
      return _account;
    }
    if (account.account.storage.state.state === 'uninit')
      _account.type = AccountType.uninit;
    else if (account.account.storage.state.state === 'active')
      _account.type = AccountType.active;
    else if (account.account.storage.state.state === 'frozen')
      _account.type = AccountType.frozen;
    else
      throw Error('Unknown account state');

    if (_account.type === AccountType.active) {
      const codeCell = account.account.storage.state.code;
      const dataCell = account.account.storage.state.data;

      _account.code = bytesToBase64(await codeCell.toBoc(false, false, false));
      _account.data = bytesToBase64(await dataCell.toBoc(false, false, false));
    } else if (_account.type === AccountType.frozen) {
      _account.state_hash = account.account.storage.state.state_hash;
    }
    _account.balance = account.account.storage.balance.grams.amount.value;
    _account.balance_other = undefined; // TODO
    _account.address = Address.fromBytes(account.account.addr.workchain_id, account.account.addr.address);
    _account.id = _account.address.toString(false);
    _account.last_trans_id = {
      id: _account.id + ':' + account.lastTransLt.toString(10) + ':' + bytesToHex(account.lastTransHash),
      lt: account.lastTransLt,
      hash: account.lastTransHash
    };
    _account.last_paid = account.account.storage_stat.last_paid;

    // TODO
    //due_payment: account.account.storage_stat.due_payment,
    //split_depth: account.account.storage.state.split_depth,
    //tick: undefined,
    //tock: undefined,
    //library: account.account.storage.state.library,

    return _account;
  }


  /**
   * Converts body cell to base64 format
   * 
   * @private
   * @param {BlockObject} body
   * @param {boolean} incomplete
   * @returns {string|undefined}
   */
  async _convertMessageBody(body, incomplete=false) {
    if (body._ !== 'Any') throw Error('not a message body');

    let refs = body.cell.refs.length - body.current_ref;
    let len = body.cell.bits.cursor - body.current_pos;

    if (len === 0)
      return undefined;
    
    const bodyCell = new Cell();

    if (incomplete)
      bodyCell.bits.writeBit(false);
    
    for (let k = 0; k < len; k++) {
      bodyCell.bits.writeBit(body.cell.bits.get(body.current_pos + k));
    }
    for (let k = 0; k < refs; k++) {
      bodyCell.refs.push(body.cell.refs[body.current_ref + k]);
    }

    const msgBoc = bytesToBase64(await bodyCell.toBoc(false, false, false));

    return msgBoc;
  }

  /**
   * Converts message from Block format
   * 
   * @private
   * @param {BlockObject} msg Message
   * @param {boolean} incompleteBody 
   * @returns {Message}
   */
  async _convertMessage(msg, incompleteBody=false) {
    if (msg === undefined) return undefined;
    if (msg._ !== 'Message') throw Error('not a Message');

    let _msg = {};
    _msg.raw = msg;

    _msg.hash = msg.hash;
    _msg.id = bytesToHex(msg.hash);

    if (msg.info.type === 'ext_in') {
      _msg.type = MessageType.ext_in;
      _msg.dst = Address.fromBytes(msg.info.dest.workchain_id, msg.info.dest.address);
    }
    else if (msg.info.type === 'ext_out') {
      _msg.type = MessageType.ext_out;
      _msg.src = Address.fromBytes(msg.info.src.workchain_id, msg.info.src.address);
      _msg.created_lt = msg.info.created_lt;
      _msg.created_at = msg.info.created_at;
    }
    else if (msg.info.type === 'int') {
      _msg.type = MessageType.int;
      _msg.bounce = msg.info.bounce;
      _msg.bounced = msg.info.bounced;
      _msg.src = Address.fromBytes(msg.info.src.workchain_id, msg.info.src.address);
      _msg.dst = Address.fromBytes(msg.info.dest.workchain_id, msg.info.dest.address);
      _msg.value = msg.info.value.grams.amount.value;
      _msg.created_lt = msg.info.created_lt;
      _msg.created_at = msg.info.created_at;
    }

    if (msg.init) {
      const codeCell = msg.init.code;
      const dataCell = msg.init.data;

      _msg.code = bytesToBase64(await codeCell.toBoc(false, false, false));
      _msg.data = bytesToBase64(await dataCell.toBoc(false, false, false));
    }

    _msg.body = msg.body ? await this._convertMessageBody(msg.body, incompleteBody) : undefined;

    return _msg;
  }


  /**
   * Converts account status
   * 
   * @private
   * @throws {Error}
   * @param {string} status
   * @returns {AccountType}
   */
  _convertAccountStatus(status) {
    switch(status) {
      case "uninit": return AccountType.uninit;
      case "frozen": return AccountType.frozen;
      case "active": return AccountType.active;
      case "nonexist": return AccountType.none;
      default: throw Error('unknown status');
    }
  }

  /**
   * Converts from block transaction format
   * 
   * @private
   * @param {BlockObject} trans Transaction to convert
   * @param {BlockId} blockId 
   */
  async _convertTransaction(trans, blockId) {
    if (trans._ !== 'Transaction') throw Error('not a transaction');

    let _trans = {};
    _trans.raw = trans;

    _trans.workchain_id = blockId.workchain;
    _trans.account_addr = Address.fromBytes(blockId.workchain, trans.account_addr);
    _trans.account_id = _trans.account_addr.toString(false);

    _trans.block_id = blockId;
    _trans.hash = trans.hash;

    _trans.lt = trans.lt;
    _trans.prev_trans_id = {
      id: _trans.account_id + ':' + trans.prev_trans_lt.toString(10) + ':' + bytesToHex(trans.prev_trans_hash),
      lt: trans.prev_trans_lt,
      hash: trans.prev_trans_hash
    };

    _trans.id = _trans.account_id + ':' + _trans.lt.toString(10) + ':' + bytesToHex(trans.hash);

    _trans.now = trans.now;
    _trans.total_fees = trans.total_fees.grams.amount.value;
    _trans.orig_status = this._convertAccountStatus(trans.orig_status);
    _trans.end_status = this._convertAccountStatus(trans.end_status);

    _trans.in_msg = await this._convertMessage(trans.in_msg, false);

    _trans.out_msgs = [];
    for (const entry of trans.out_msgs.map.entries()) {
      const msg = await this._convertMessage(entry[1], false);
      _trans.out_msgs.push(msg);
    }

    if (trans.description.type === 'ord') {
      _trans.type = TransactionType.ord;
      _trans.aborted = trans.description.aborted;
      _trans.destroyed = trans.description.destroyed;
    } else if (trans.description.type === 'storage') {
      _trans.type = TransactionType.storage;
    } else if (trans.description.type === 'tick_tock') {
      _trans.type = TransactionType.tick_tock;
      _trans.aborted = trans.description.aborted;
      _trans.destroyed = trans.description.destroyed;
    } else {
      throw Error('unknown transaction type');
    }

    _trans.old_hash = trans.state_update.old_hash;
    _trans.new_hash = trans.state_update.new_hash;

    return _trans;
  }
  
  /**
   * Converts account to internal format (for tvm)
   * 
   * @private
   * @param {Account} account
   * @returns {Object}
   */
  _convertAccountToInternal(account) {

    if (account.type === AccountType.none)
      throw Error('Account not exist');

    const _account = {
      acc_type: account.type,
      code: account.code,
      data: account.data,
      balance: account.balance ? '0x' + account.balance.toString(16) : undefined,
      balance_other: account.balance_other,
      id: account.id,
      last_trans_lt: account.last_trans_id.lt ? '0x' + account.last_trans_id.lt.toString(16) : undefined,
      last_paid: account.last_paid
    };

    return _account;
  }

  /**
   * Converts account from internal format
   * 
   * @private
   * @param {Object} account 
   * @returns {Account}
   */
  _convertAccountFromInternal(account) {

    const _account = {
      type: account.acc_type,
      code: account.code,
      data: account.data,
      balance: new BN(account.balance.replace('0x', ''), 16),
      balance_other: undefined, // TODO
      id: account.id,
      address: new Address(account.id),
      last_trans_id: undefined,
      last_paid: account.last_paid
    };
    return _account;

  }

 /**
  * Estimates fees
  * 
  * @private
  * @throws {Error}
  * @param {{account:Account,address:Address, messageBodyBase64:string, emulateBalance:boolean}} params 
  * @returns {Promise<Fees>}
  */
  async _estimateFee(params) {
    let account;

    if (params.account)
      account = this._convertAccountToInternal(params.account);
    else
      account = {
        id: params.address.toString(false)
      };

    if (account.last_paid === undefined)
      account.last_paid = Math.floor(Date.now() / 1000);

    if (account.balance === undefined || params.emulateBalance)
      account.balance = this.bigBalance;

    let res = (await this.client.requestCore('contracts.run.fee.msg', {
      address: params.address.toString(false),
      account,
      messageBase64: params.messageBodyBase64,
    })).fees;

    return {
      gasFee: new BN(res.gasFee.replace('0x', ''), 16),
      inMsgFwdFee: new BN(res.inMsgFwdFee.replace('0x', ''), 16),
      outMsgsFwdFee: new BN(res.outMsgsFwdFee.replace('0x', ''), 16),
      storageFee: new BN(res.storageFee.replace('0x', ''), 16),
      totalAccountFees: new BN(res.totalAccountFees.replace('0x', ''), 16),
      totalOutput: new BN(res.totalOutput.replace('0x', ''), 16)
    };
  }

  /**
   * Runs message in TVM
   * 
   * @private
   * @throw {Error}
   * @param {{account:Account, address:Address, emulateBalance:boolean, functionName:string, abi:Object, messageBodyBase64:string, fullRun:boolean}} params 
   * @returns {{account:Account, output:Object, fee:Fees}}
   */
  async _runMessageLocal(params) {
    let account;

    if (params.account)
      account = this._convertAccountToInternal(params.account);
    else
      account = {
        id: params.address.toString(false)
      };

    if (account.last_paid === undefined)
      account.last_paid = Math.floor(Date.now() / 1000);

    if (account.balance === undefined || params.emulateBalance)
      account.balance = this.bigBalance;

    if (!params.functionName || !params.abi) {
      params.abi = {
        "ABI version": 2,
        "header": [],
        "functions": [
          {
          "name": "dummy",
          "inputs": [],
          "outputs": []
          }
        ],
        "data": [],
        "events": []
      };
      params.functionName = 'dummy';
    }

    let res = await this.client.requestCore('contracts.run.local.msg', {
        address: params.address.toString(false),
        account,
        abi: params.abi,
        functionName: params.functionName,
        messageBase64: params.messageBodyBase64,
        fullRun: params.fullRun
    });
    return {
      account: res.account ? this._convertAccountFromInternal(res.account) : undefined,
      output: res.output,
      fee: res.fee ? {
        gasFee: new BN(res.fee.gasFee.replace('0x', ''), 16),
        inMsgFwdFee: new BN(res.fee.inMsgFwdFee.replace('0x', ''), 16),
        outMsgsFwdFee: new BN(res.fee.outMsgsFwdFee.replace('0x', ''), 16),
        storageFee: new BN(res.fee.storageFee.replace('0x', ''), 16),
        totalAccountFees: new BN(res.fee.totalAccountFees.replace('0x', ''), 16),
        totalOutput: new BN(res.fee.totalOutput.replace('0x', ''), 16)
      } : undefined
    };
  }

  /**
   * Runs ABI get method
   * 
   * @private
   * @todo Output conversion
   * @throws {Error}
   * @param {Account} account 
   * @param {string} functionName 
   * @param {Object} input 
   */
  async _runGet(account, functionName, input) {

    let acc = this._convertAccountToInternal(account);

    let result = await this.client.runGet({
      codeBase64: acc.code,
      dataBase64: acc.data,
      input: input,
      functionName: functionName
    });
    
    return result;
  }

  /**
   * Checks message hash
   * 
   * @param {Message} message Sended message
   * @param {BlockObject} inMsg Inblund message in transaction
   * @returns {boolean} 
   */
  _checkMessageHash(message, inMsg) {
    if (inMsg._ !== 'Message')
      return false;

    return message.hash === bytesToHex(inMsg.hash); //TODO ???
  }

  /**
   * Runs message
   * 
   * @private
   * @param {MessageInfo} message Message to send
   * @param {string} accountPreState Expected state of account before message send ('uninit', 'active', 'frozen')
   * @param {Number} totalTimeout Timeout time (UTC time in seconds), 0 - send message, but do not wait for confirmation
   * @param {Function} checkMessageFunc Function for check message equivalence
   * @param {Function} saveMessageFunc Function for save message before send to network
   * @returns {Promise<{ok:boolean, sended:boolean, confirmed:boolean}>} ok - is message was successfully transacted, sended - is message was sended to network, confirmed - is message status was confirmed
   */
  async _runMessage(message, accountPreState, totalTimeout, checkMessageFunc, saveMessageFunc) {
    
    // ===! 1 stage - get current account state

    let accountPre;
    try {
      accountPre = await this._getAccount();
      if (!accountPre.ok) {
        return {
          ok: false,
          sended: false,
          reason: 'Cannot get account state: ' + accountPre.reason
        };
      }
      if (accountPre.account.type === 'none') {
        return {
          ok: false,
          sended: false,
          reason: 'Account does not exist'
        };
      }
      if(accountPreState !== undefined &&
        accountPre.account.storage.state.state !== accountPreState) {
        return {
          ok: false,
          sended: false,
          reason: 'Invalid initial account state "' + accountPre.account.storage.state.state + '"" expected "' + accountPreState +'"'
        };
      }
    } catch (e) {
      return {
          ok: false,
          sended: false,
          reason: 'Cannot get account state: ' + e.toString()
        };
    }

    let currentLastTransLt = accountPre.lastTransLt;
    let currentLastTransHash = accountPre.lastTransHash;
    let currentShardBlockUtime = accountPre.blockHeader.info.gen_utime;

    // ===! 2 stage - save message with latest lt & hash

    if (saveMessageFunc) {
      try {
        await saveMessageFunc(message, currentLastTransLt, currentLastTransHash);
      } catch (e) {
        return {
          ok: false,
          sended: false,
          reason: 'Message not saved: ' + e.toString(),
          account: accountPre
        };
      }
    }

    // ===! 3 stage - final checks before send

    let now = Math.floor(Date.now() / 1000);

    if (message.expire !== undefined && (now > message.expire || currentShardBlockUtime >= message.expire)) {
      return {
        ok: false,
        sended: false,
        reason: 'Message already expired',
        account: accountPre
      };
    }

    // ===! 4 stage - send message to network

    let sendRes = await this.sendMessage(message);
    if (!sendRes.ok)
      console.warn('Message send is not ok, but we must wait for message expiration before new try');

    // ===! 5 stage - wait for transaction

    let accountCurr;

    let cycleTimeout;
    if (message.expire === undefined && totalTimeout === undefined)
      cycleTimeout = Math.floor((Date.now()  + this.config.runTimeout) / 1000);

    // eslint-disable-next-line no-constant-condition
    while(true) {

      now = Math.floor(Date.now() / 1000);

      if ((cycleTimeout !== undefined && now > cycleTimeout) ||
          (totalTimeout !== undefined && now > totalTimeout)) {
        return {
          ok: false,
          sended: true,
          confirmed: false,
          reason: 'Timeout while waiting transaction confirmation',
          lastTransLt: currentLastTransLt,
          lastTransHash: currentLastTransHash,
          lastShardUtime: currentShardBlockUtime,
          account: accountCurr || accountPre
        };
      }

      let accountLatest = await this._getAccount();
      if (!accountLatest.ok || accountLatest.account.type === 'none') {
        return {
          ok: false,
          sended: true,
          confirmed: false,
          reason: 'Cannot get account state or account doesnot exist: ' + accountLatest.reason,
          lastTransLt: currentLastTransLt,
          lastTransHash: currentLastTransHash,
          lastShardUtime: currentShardBlockUtime,
          account: accountCurr || accountPre
        };
      }

      accountCurr = accountLatest;

      if (!accountCurr.lastTransLt.eq(currentLastTransLt)) {

        // there are new transactions, check them all

        let pageLastTransLt = accountCurr.lastTransLt;
        let pageLastTransHash = accountCurr.lastTransHash;
        let transactionTryCount = this.config.queryTryCount;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          let transRes = await this.block.getTransactions(10, this.address, pageLastTransLt, pageLastTransHash, currentLastTransLt);
          if (!transRes.ok || transRes.transactionList.length === 0) {
            transactionTryCount--;
            if (transactionTryCount <= 0) {
              return {
                ok: false,
                sended: true,
                confirmed: false,
                reason: 'Cannot get transaction list',
                lastTransLt: currentLastTransLt,
                lastTransHash: currentLastTransHash,
                lastShardUtime: currentShardBlockUtime,
                account: accountCurr
              };
            }
            continue;
          }

          transactionTryCount = this.config.queryTryCount;

          // search for our message hash
          for (let j = 0; j < transRes.transactionList.length; j++) {
            const transaction = transRes.transactionList[j];

            //console.log('check transaction', transaction);
            try {

              if (transaction.in_msg.info.type !== 'ext_in') {
                //console.log('transaction not external');
                continue;
              }

              const signValid = checkMessageFunc !== undefined ?
                                  checkMessageFunc(message, transaction.in_msg) :
                                  this._checkMessageHash(message, transaction.in_msg);

              if (signValid) {
                return {
                  ok: true,
                  sended: true,
                  confirmed: true,
                  transaction: transaction,
                  account: accountCurr
                };
              }
            } catch (e) {
              return {
                ok: false,
                sended: true,
                confirmed: false,
                reason: 'Error while processing transactions: ' + e.toString(),
                lastTransLt: currentLastTransLt,
                lastTransHash: currentLastTransHash,
                lastShardUtime: currentShardBlockUtime,
                account: accountCurr
              };
            }
          }

          pageLastTransLt = transRes.transactionList[transRes.transactionList.length-1].prev_trans_lt;
          pageLastTransHash = transRes.transactionList[transRes.transactionList.length-1].prev_trans_hash;

          if (pageLastTransLt.eq(currentLastTransLt)) {
            if (!compareBytes(pageLastTransHash, currentLastTransHash)) {
              return {
                ok: false,
                sended: true,
                confirmed: false,
                reason: 'Incorrect transaction hash: get ' + bytesToHex(pageLastTransHash) + ' expected ' + bytesToHex(currentLastTransHash),
                lastTransLt: currentLastTransLt,
                lastTransHash: currentLastTransHash,
                lastShardUtime: currentShardBlockUtime,
                account: accountCurr
              };
            }
            break;


          }
        }
      }

      currentLastTransLt = accountCurr.lastTransLt;
      currentLastTransHash = accountCurr.lastTransHash;
      currentShardBlockUtime = accountCurr.blockHeader.info.gen_utime;

      if (message.expire !== undefined && currentShardBlockUtime > message.expire) {
        return {
          ok: false,
          sended: true,
          confirmed: true,
          lastTransLt: currentLastTransLt,
          lastTransHash: currentLastTransHash,
          lastShardUtime: currentShardBlockUtime,
          account: accountCurr
        };
      }

      // TODO wait for next block
      await (new Promise(resolve => setTimeout(resolve, 2000)));
    }
  }

  /**
   * Is message was transacted
   * 
   * @param {MessageInfo} message Message sended to network
   * @param {BN} fromTransLt Last transaction logical time before message sended
   * @param {Uint8Array} fromTransHash Last transaction hash before message sended
   * @param {Function} checkMessageFunc Function for check message equivalence
   * @returns {Promise<{ok:boolean, confirmed:boolean, delivered:boolean}>} ok - is query was successfull, confirmed - is message final status was confirmed, delivered - is message was transacted
   */
  async checkMessageDelivery(message, fromTransLt, fromTransHash, checkMessageFunc) {

    let accountCurr = await this._getAccount();
    if (!accountCurr.ok || accountCurr.account.type === 'none') {
      return {
        ok: false,
        reason: 'Cannot get account state or account does not exist: ' + accountCurr.reason
      };
    }

    if (!accountCurr.lastTransLt.eq(fromTransLt)) {

      // there are new transactions, check them all

      let pageLastTransLt = accountCurr.lastTransLt;
      let pageLastTransHash = accountCurr.lastTransHash;
      let transactionTryCount = this.config.queryTryCount;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let transRes = await this.block.getTransactions(10, this.address, pageLastTransLt, pageLastTransHash, fromTransLt);
        if (!transRes.ok || transRes.transactionList.length === 0) {
          transactionTryCount--;
          if (transactionTryCount <= 0) {
            return {
              ok: false,
              reason: 'Cannot get transaction list',
              account: accountCurr
            };
          }
          continue;
        }

        transactionTryCount = this.config.queryTryCount;

        // search for our message hash
        for (let j = 0; j < transRes.transactionList.length; j++) {
          const transaction = transRes.transactionList[j];

          //console.log('check transaction', transaction);
          try {

            if (transaction.in_msg.info.type !== 'ext_in') {
              //console.log('transaction not external');
              continue;
            }

            const signValid = checkMessageFunc !== undefined ?
                                checkMessageFunc(message, transaction.in_msg) :
                                this._checkMessageHash(message, transaction.in_msg);

            if (signValid) {
              return {
                ok: true,
                delivered: true,
                confirmed: true,
                transaction: transaction,
                account: accountCurr
              };
            }
          } catch (e) {
            return {
              ok: false,
              reason: 'Error while processing transactions: ' + e.toString(),
              account: accountCurr
            };
          }
        }

        pageLastTransLt = transRes.transactionList[transRes.transactionList.length-1].prev_trans_lt;
        pageLastTransHash = transRes.transactionList[transRes.transactionList.length-1].prev_trans_hash;

        if (pageLastTransLt.eq(fromTransLt)) {
          if (!compareBytes(pageLastTransHash, fromTransHash)) {
            return {
              ok: false,
              sended: true,
              confirmed: false,
              reason: 'Incorrect transaction hash: get ' + bytesToHex(pageLastTransHash) + ' expected ' + bytesToHex(currentLastTransHash),
              lastTransLt: currentLastTransLt,
              lastTransHash: currentLastTransHash,
              lastShardUtime: currentShardBlockUtime,
              account: accountCurr
            };
          }
          break;
        }
      }
    }

    let currentLastTransLt = accountCurr.lastTransLt;
    let currentLastTransHash = accountCurr.lastTransHash;
    let currentShardBlockUtime = accountCurr.blockHeader.info.gen_utime;

    if (message.expire !== undefined && currentShardBlockUtime > message.expire) {
      return {
        ok: true,
        delivered: false,
        confirmed: true,
        lastTransLt: currentLastTransLt,
        lastTransHash: currentLastTransHash,
        lastShardUtime: currentShardBlockUtime,
        account: accountCurr
      };
    }

    return {
      ok: true,
      delivered: false,
      confirmed: false,
      lastTransLt: currentLastTransLt,
      lastTransHash: currentLastTransHash,
      lastShardUtime: currentShardBlockUtime,
      account: accountCurr
    };
  }

  /**
   * Get payload gell from string
   * 
   * @param {string} payload 
   * @returns {Promise<string>} Payload BOC in base64 format
   */
  async getPayloadFromString(payload) {
    const payloadCell = new Cell();

    if (typeof payload === 'string') {
      if (payload.length > 0) {
        if (payload.length > 250)
          payload = payload.substring(0, 250);
        payloadCell.bits.writeUint(0, 32);
        payloadCell.bits.writeBytes(stringToBytes(payload));
      }
    }

    return bytesToBase64(await payloadCell.toBoc(false, false, false));
  }

  /**
   * Gets string from payload
   * 
   * @param {string} payloadBase64 Payload BOC in base64 format
   * @returns {Promise<string>} String from payload 
   */
  async getStringFromPayload(payloadBase64) {
    const payloadCell = await Cell.fromBoc(base64ToBytes(payloadBase64));

    if (payloadCell.bits.cursor < 32)
      return;

    const h = payloadCell.bits.readUint32(0);
    if (h === 0) {
      if (payloadCell.bits.cursor < 40)
        return "";

      const strBytes = payloadCell.bits.getRange(32, payloadCell.bits.cursor - 32);
      return bytesToString(strBytes);
    }
  }

}


module.exports = {Contract};