const {TONClient, setWasmOptions} = require('ton-client-web-js');
const {stringToBytes, bytesToString, bytesToBase64, base64ToBytes, bytesToHex, BN} = require('../utils');
const {Address, Cell} = require('../types');
const {Block} = require('../blockchain/Block');


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

  constructor(provider, storage, client) {
    this.provider = provider || Contract._provider;
    this.client = client || Contract._client;
    this.methods = {};

    // Block api object
    this.block = new Block(provider, storage);

    this.bigBalance = '0x10000000000000';

    this.config = {
      sendTryCount: 10,
      queryTryCount: 10,
      expireDefault: 10000,
      expireExtDefault: 60000,
      syncMaxDiff: 30,
      runTimeout: 60000
    }
  }

  static debugLog(msg) {
    console.log(msg);
  }

  static async init() {
    if (Contract._client)
      return;

    setWasmOptions({
        debugLog: Contract.debugLog
    });

    Contract._client = (await TONClient.create({
        servers: ['']
    })).contracts;
  }


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

  /*
  from TransactionId
  to TransactionId
  returns [Transaction]
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

  /*
  Get raw account
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

  /*
  get account
  */
  async getAccount() {
    if (!this.address) throw Error('no account address');

    const a = await this._getAccount();
    if (!a.ok) throw Error('Cannot get account state: ' + a.reason);

    // convert
    return await this._convertAccount(a);
  }

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

  /*
  interface BlockObject {
    _: string;
    cell?: Cell;
    hash?: Uint8Array;  
  }

  interface TransactionId {
    lt: BN;
    hash: Uint8Array;
  }

  interface Account {
    type: AccountType;
    code?: string; // base64
    data?: string; // base64
    balance: BN;
    balance_other?: any;
    id: string; // address in hex
    address: Address;
    state_hash?: Uint8Array;
    last_trans_id?: TransactionId;
    last_paid?: number;
    raw?: BlockObject;
  }

  convert from raw account to account
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


  /*

  interface Message {
    raw: BlockObject;
    id: string; // hash in hex
    hash: Uint8Array;
    type: MessageType;
    src: Address;
    dst: Address;
    bounce?: bool;
    bounced?: bool;
    value?: BN;
    created_at?: number;
    created_lt?: BN;
    code?: string; // base64
    data?: string; // base64
    body?: string; // base64
  }
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

  async _convertMessage(msg, incompleteBody=false) {
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


  /*
  interface Transaction {
    id: string; // hash in hex
    hash: Uint8Array;
    
    type: TransactionType;

    lt: BN;
    now: number;
    prev_trans_id: TransactionId;
    total_fees: BN;
    
    orig_status: AccountType;
    end_status: AccountType;
    
    in_msg: Message;
    out_msgs: [Message];

    aborted?: bool;
    destroyed?: bool;

    old_hash: Uint8Array;
    new_hash: Uint8Array;

    workchain_id: number;
    account_addr: Address;
    account_id: string; // address in hex
    block_id: BlockId;
  }
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

  async _convertTransaction(trans, blockId) {
    if (trans._ !== 'Transaction') throw Error('not a transaction');

    let _trans = {};
    _trans.raw = trans;

    _trans.block_id = blockId;
    _trans.hash = trans.hash;
    _trans.id = bytesToHex(trans.hash);

    _trans.lt = trans.lt;
    _trans.prev_trans_id = {
      lt: trans.prev_trans_lt,
      hash: trans.prev_trans_hash
    };
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

    _trans.workchain_id = blockId.workchain;
    _trans.account_addr = Address.fromBytes(blockId.workchain, trans.account_addr);
    _trans.account_id = _trans.account_addr.toString(false);

    return _trans;
  }
  
  /*
  account to internal format
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

  /*
  account Account
  address Address
  emulateBalance bool
  messageBodyBase64 string
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

  /*
  account Account
  address Address
  emulateBalance bool
  functionName string
  abi Object
  messageBodyBase64 string
  fullRun bool
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

  async _runGet(account, functionName, input) {
    // TODO
    let acc = this._convertAccountToInternal(account);

    let result = await this.client.runGet({
      codeBase64: acc.code,
      dataBase64: acc.data,
      input: input,
      functionName: functionName
    });
    
    return result;
  }

  _checkMessageHash(message, inMsg) {
    if (inMsg._ !== 'Message')
      return false;

    return message.hash === bytesToHex(inMsg.hash);
  }


  /*
  accountPreState 'uninit', 'active', 'frozen'
  totalTimeout (UTC time in seconds), 0 = send message, but do not wait for confirmation
  */
  async _runMessage(message, accountPreState, totalTimeout, checkMessageFunc) {
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

    let now = Math.floor(Date.now() / 1000);

    if (message.expire !== undefined && (now > message.expire || currentShardBlockUtime >= message.expire)) {
      return {
        ok: false,
        sended: false,
        reason: 'Message already expired',
        account: accountPre
      };
    }

    let sendRes = await this.sendMessage(message);
    if (!sendRes.ok)
      console.warn('Message send is not ok, but we must wait for message expiration before new try');

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
              console.log('error', e);
            }
          }

          pageLastTransLt = transRes.transactionList[transRes.transactionList.length-1].prev_trans_lt;
          pageLastTransHash = transRes.transactionList[transRes.transactionList.length-1].prev_trans_hash;

          if (pageLastTransLt.eq(currentLastTransLt))
            break;
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

  // payload <string>
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