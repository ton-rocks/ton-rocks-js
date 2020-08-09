const {TONClient, setWasmOptions} = require('ton-client-web-js');
const {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes, nacl, BN} = require('../utils');
const {Address, Cell} = require('../types');
const {Block} = require('../blockchain/Block');
const {BlockParser} = require('../blockchain/BlockParser');

// TODO block validation sometimes failed
// TODO out of sync try too quick


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

class ContractV2 {

  static get AccountType() {
    return AccountType;
  }

  static get MessageType() {
    return MessageType;
  }

  static get TransactionType() {
    return TransactionType;
  }

  constructor(provider, client) {
    this.provider = provider || this._provider;
    this.client = client || ContractV2._client;
    this.methods = {};

    // Block api object
    this.block = new Block();

    this.bigBalance = '0x10000000000000';

    this.config = {
      sendTryCount: 3,
      queryTryCount: 3,
      expireDefault: 10000,
      expireExtDefault: 60000,
      syncMaxDiff: 30,
      runTimeout: 20000
    }
  }

  static debugLog(msg) {
    console.log(msg);
  }

  static async init() {
    if (ContractV2._client)
      return;

    setWasmOptions({
        debugLog: ContractV2.debugLog
    });

    ContractV2._client = (await TONClient.create({
        servers: ['']
    })).contracts;
  }


  async sendMessage(message) {
    let sendRes;
    for (let j = 0; j < this.config.sendTryCount; j++) {
      sendRes = await this.block.sendMessage(message.messageBodyBase64);
      console.log('sendRes', sendRes);
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
        console.log('latestBlockId', blockId);
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
        console.log('account', account);
        if (!account.ok) 
          throw Error('Cannot get account state: ' + account.reason);

        break;
      } catch (e) {
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

  async _runGet(code, data, functionName, input) {
    // TODO
    let result = await this.client.runGet({
      codeBase64: code,
      dataBase64: data,
      input: input,
      functionName: functionName
    });
    return result;
  }

  async _runGetAccount(functionName, input) {
    const a = await this._getAccount();

    let acc = await this._convertAccount(a);
    let account = this._convertAccountToInternal(acc);

    return await this._runGet(account.code, account.data, functionName, input);
  }

  _checkMessage(message, inMsg) {
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

  /*
  accountPreState 'uninit', 'active', 'frozen'
  totalTimeout (UTC time in seconds), 0 = send message, but do not wait for confirmation
  */
  async _runMessage(message, accountPreState, totalTimeout) {
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

            console.log('check transaction', transaction);
            try {

              if (transaction.in_msg.info.type !== 'ext_in') {
                console.log('transaction not external');
                continue;
              }

              const signValid = this._checkMessage(message, transaction.in_msg);
              console.log('signValid', signValid);

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

      if (currentShardBlockUtime > message.expire) {
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

}

class AbiContract extends ContractV2 {
  constructor(params, provider) {
    super(provider);

    if (!this.client) throw Error('no tvm');
    if (!params.abiPackage) throw Error('no abi package');
    if (params.abiPackage['ABI version'] < 2) throw Error('too old abi');
    if (!params.keys && !params.address) throw Error('specify keys or address');

    this.abiPackage = params.abiPackage;
    
    this.keys = params.keys;
    this.address = params.address ? new Address(params.address) : undefined;
    this.signCallback = params.signCallback;

    /*
    wc
    header
    input
    init
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
        // TODO sign with external function
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
        /*
        tryNum
        totalTimeout (UTC time in seconds)
        */
        run: async (p = {}) => {
          let res;
          let tryNum = p.tryNum || 3;
          for (let t = 0; t < tryNum; t++) {
            let msg = await getDeployMessage();
            res = await this._runMessage(msg, 'uninit', p.totalTimeout);
            console.log('run try', t, ': ', res);
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
      /*
      input
      header
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
          /*
          */
          getMessage: getMessage,
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
          account
          fullRun
          emulateBalance
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
          /*
          tryNum
          totalTimeout (UTC time in seconds)
          */
          run: async (p = {}) => {
            let res;
            let tryNum = p.tryNum || 3;

            for (let t = 0; t < tryNum; t++) {
              let msg = await getMessage();
              res = await this._runMessage(msg, 'active', p.totalTimeout);
              console.log('run try', t, ': ', res);

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

  _getKeys(keys) {
    return keys ? {
        secret: keys.secretKey ? bytesToHex(keys.secretKey.subarray(0, 32)) : undefined,
        public: keys.publicKey ? bytesToHex(keys.publicKey) : undefined
    } : undefined;
  }

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
    }

    //params.keyPair = this._getKeys(params.keyPair);
    //const message = await this.client.requestCore('contracts.deploy.message', params);
    //return message;
  }

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


  /*
  msg (Message or Cell or Base64 string of boc)
  incomplete - message returned by encode_unsigned_message
  functionName - string (search for functionName)
  */
  async decodeInput(msg, abi, incomplete=false, functionName) {
    if (typeof msg === 'string')
      msg = await Cell.fromBoc(utils.base64ToBytes(msg));

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


  /*
  transaction
  abi
  functionName
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

  /*
  msg (Message or Cell or Base64 string of boc)
  functionName - string (search for functionName)
  */
  async decodeOutput(msg, abi, functionName) {
    if (typeof msg === 'string')
      msg = await Cell.fromBoc(utils.base64ToBytes(msg));

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


  /*
  transaction
  abi
  functionName
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


module.exports = {ContractV2, AbiContract};