const {BitString, Cell, Address} = require("../types");
const {BN, sha256, compareBytes, base64ToBytes, bytesToBase64, bytesToBinString} = require("../utils");
const {BlockParser} = require("./BlockParser");
const {BlockId} = require("./BlockId");
const {Storage} = require("../providers/Storage");

class Block {

  constructor(id, provider, storage) {
    this.provider = provider || this._provider;
    this.storage = storage || this._storage;
    this.zero_state = new BlockId(this.provider.getZeroState());
    this.id = undefined;
    if (id !== undefined)
      this.setId(id);
    else
      this.invalidate();
  }

  invalidate() {
    this.validated = false;
  }

  setId(id) {
    if (this.id && this.id.compare(id))
      return;
    this.id = id;
    this.invalidate();
  }

  async getLatestId() {
    let result = {ok:false};
    try {
      let res = await this.provider.getLatestBlockId();
      if (!res)
        throw Error("empty answer");

      this.setId(res);

      result.ok = true;
      result.id = this.id;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get latest block:', e);
    }
    return result;
  }

  async lookup(lt, utime) {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");

      let res = await this.provider.lookupBlock(this.id, lt, utime);
      if (!res)
        throw Error("empty answer");

      const blockProofCell = await Cell.fromBoc(res.header_proof);

      if (blockProofCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(res.id.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (!(lt || utime) && blockHeader.info.seq_no !== this.id.seqno)
        throw Error("Invalid seqno");
      if (!this.id.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== this.id.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (this.id.workchain !== -1))
        throw Error("Invalid not_master");
      if (utime && blockHeader.info.gen_utime !== utime)
        throw Error("Invalid utime");
      if (lt && (lt.lt(blockHeader.info.start_lt) || lt.gt(blockHeader.info.end_lt)))
        throw Error("Invalid lt");

      // save
      this.setId(res.id);

      result.ok = true;
      result.id = res.id;
      result.blockHeader = blockHeader;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot lookup block:', e);
    }
    return result;
  }

  async getHeader() {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");

      let res = await this.provider.getBlockHeader(this.id);
      if (!res)
        throw Error("empty answer");

      const blockProofCell = await Cell.fromBoc(res.header_proof);

      if (blockProofCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(this.id.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== this.id.seqno)
        throw Error("Invalid seqno");
      if (!this.id.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== this.id.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (this.id.workchain !== -1))
        throw Error("Invalid not_master");

      result.ok = true;
      result.blockHeader = blockHeader;

      return blockHeader;
    } catch(e) {
      result.reason = e;
      console.log('Cannot lookup block:', e);
    }
    return result;
  }


  async getData() {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");

      let res = await this.provider.getBlock(this.id);
      if (!res)
        throw Error("Cannot get block data");

      // check file_hash
      const hash = await sha256(res.data);
      if (!compareBytes(new Uint8Array(this.id.file_hash.buffer), new Uint8Array(hash)))
        throw Error("Invalid file_hash");

      const blockCell = await Cell.fromBoc(res.data);

      if (blockCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (!compareBytes(new Uint8Array(this.id.root_hash.buffer), blockCell[0].getHash(0)))
        throw Error("Invalid root_hash");

      const block = BlockParser.parseBlock(blockCell[0]);

      // check other
      if (block.info.seq_no !== this.id.seqno)
        throw Error("Invalid seqno");
      if (!this.id.compareShard(block.info.shard.shard))
        throw Error("Invalid shard");
      if (block.info.shard.workchain_id !== this.id.workchain)
        throw Error("Invalid workchain");
      if (block.info.not_master != (this.id.workchain !== -1))
        throw Error("Invalid not_master");

      result.ok = true;
      result.block = block;

      return result;
    } catch(e) {
      result.reason = e;
      console.log(e);
    }
    return result;
  }

  async validate() {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");

      let knownBlocks = this.storage.getKnownBlocks();
      if (!knownBlocks["0"]) {
        this.storage.addBlock(this.zero_state);
      }

      if (knownBlocks[this.id.seqno])
        return true;

      let from = null;
      for (var key in knownBlocks) {
        const value = knownBlocks[key];
        if (!from || (value.seqno < this.id.seqno && value.seqno > from.seqno)) {
          from = value;
        }
      }

      if (!from)
        throw Error("No known blocks");

      // main validation cycle
      for (let i = 0; i < 10000; i++) {

        let blockProof = await this.provider.getBlockProof(from, this.id);

        if (!from.compare(blockProof.from))
          throw Error("Invalid response");

        if (blockProof.from.workchain !== -1 || !compareShard(blockProof.from.shard, shardMasterchain) ||
            blockProof.to.workchain !== -1 || !compareShard(blockProof.to.shard, shardMasterchain))
          throw Error("BlockProof must have both source and destination blocks in the masterchain");

        if (blockProof.steps.length < 1)
          throw Error("BlockProof length 0");

        let curr = blockProof.from;
        for (let k of blockProof.steps) {
          if (k['_'] !== 'liteServer.blockLinkBack' && k['_'] !== 'liteServer.blockLinkForward')
            throw Error("Invalid BlockProofLink");

          const fwd = k['_'] === 'liteServer.blockLinkForward';

          if (!compareBlockIdExt(curr, k.from))
            throw Error("Invalid BlockProof chain");

          if (k.from.workchain !== -1 || !compareShard(k.from.shard, shardMasterchain) ||
              k.to.workchain !== -1 || !compareShard(k.to.shard, shardMasterchain))
            throw Error("BlockProofLink must have both source and destination blocks in the masterchain");

          if (k.from.seqno === k.to.seqno)
            throw Error("BlockProofLink connects two masterchain blocks of equal height");

          if (fwd !== k.to.seqno > k.from.seqno)
            throw Error("BlockProofLink invalid type");

          let dest_proof = k.dest_proof;
          let proof = fwd ? k.config_proof : k.proof;
          if (dest_proof.length === 0 && k.to.seqno > 0)
            throw Error("BlockProofLink contains no proof for destination block");
          if (proof.length === 0)
            throw Error("BlockProofLink contains no proof for source block");

          if (fwd && k.signatures.signatures.length === 0)
            throw Error("a forward BlockProofLink contains no signatures");
          if (!fwd && k.state_proof.length === 0)
            throw Error("a backward BlockProofLink contains no proof for the source state");

          const proofCell = await Cell.fromBoc(proof);
          let state_hash;
          let utime;
          if (k.from.seqno > 0) {
            const block = BlockParser.checkBlockHeader(proofCell[0], k.from);
            if (!fwd) {
              // current ShardState of a block
              state_hash = block.state_update.refs[1].getHash(0);
            }
          }
          if (k.to.seqno > 0) {
            const destProofCell = await Cell.fromBoc(dest_proof);
            const block = BlockParser.checkBlockHeader(destProofCell[0], k.to);
            if (block.info.key_block !== k.to_key_block)
              throw Error("Incorrect is_key_block value");

            utime = block.info.gen_utime;
          }
          if (!fwd) {
            // check a backward link
            const stateProofCell = await Cell.fromBoc(k.state_proof);
            if (stateProofCell.type !== 3 || !compareBytes(state_hash, stateProofCell.refs[0].getHash(0)))
              throw Error("BlockProofLink contains a state proof for with incorrect root hash");

          } else {
            // check a forward link
          }


          curr = k.to;
          //knownBlocks[curr.seqno] = curr;
          this.storage.addBlock(curr);
        }
        
        from = blockProof.to;

        if (compareBlockIdExt(from, this.id)) {
          break;
        }
      }

      this.storage.save();
      return true;

    } catch(e) {
      result.reason = e;
      console.log(e);
      this.storage.save();
      return false;
    }
    return result;
  }

  async getShards() {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");
      if (this.id.workchain !== -1)
        throw Error("Block is not a masterchain");

      let res = await this.provider.getAllShardsInfo(this.id);
      if (!res)
        throw Error("empty answer");

      const shardHashesCell = (await Cell.fromBoc(res.data))[0];
      // HashmapE root from next ref
      const shardHashesHash = shardHashesCell.refs[0].getHash(0);

      const blockProofCell = await Cell.fromBoc(res.proof);
      // [0] Block -> ShardState
      // [1] ShardState -> shard_hashes

      if (blockProofCell.length !== 2)
        throw Error("Invalid root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(this.id.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== this.id.seqno)
        throw Error("Invalid seqno");
      if (!this.id.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== this.id.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (this.id.workchain !== -1))
        throw Error("Invalid not_master");

      // extract MC ShardState hash
      const mcShardStateHash = blockHeader.state_update.new_hash;

      // check MC ShardState hash
      if (blockProofCell[1].type !== Cell.MerkleProofCell ||
          !compareBytes(mcShardStateHash, blockProofCell[1].refs[0].getHash(0)))
        throw Error("Invalid shard info hash");

      const mcShardState = BlockParser.parseShardState(blockProofCell[1].refs[0]);

      // get & check shard info hash
      if (!compareBytes(shardHashesHash, mcShardState.custom.shard_hashes.hash))
        throw Error("Invalid shard info hash");

      const shardHashes = BlockParser.parseShardHashes(shardHashesCell);

      result.ok = true;
      result.shardHashes = shardHashes;
      result.blockHeader = blockHeader;
      result.shardState = mcShardState;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get shard info:', e);
    }
    return result;
  }

  async getTransactions(maxCount, accountAddr, lt, hash) {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");

      const address = new Address(accountAddr);

      let last_lt = lt;
      let last_hash = hash;
      let transactionList = [];
      let blockIdList = [];

      let requests = Math.ceil(maxCount/10);
      let pending = maxCount;

      for (let r = 0; r < requests; r++) {
        const count = Math.min(pending, 10);

        let res;
        try {
          res = await this.provider.getTransactions(count, accountAddr, last_lt, last_hash);
        } catch(e) {
          if (!compareBytes(last_hash, new Uint8Array(32)) || !last_lt.eq(new BN(0))) {
            console.warn('Obtained less transactions than required');
          }

          result.ok = true;
          result.transactionList = transactionList;
          result.blockIdList = blockIdList;
      
          return transactionList;
        }

        if (!res) 
          throw Error("empty answer");

        const transactionsCell = await Cell.fromBoc(res.transactions);
        if (transactionsCell.length !== res.ids.length)
          throw Error('Invalid answer');

        let checkLast = transactionsCell.length !== count;
        pending -= transactionsCell.length;

        for (let i = 0; i < transactionsCell.length; i++) {
          if (!compareBytes(last_hash, transactionsCell[i].getHash(0))) {
            throw Error('Invalid hash in transaction list');
          }
          const tr = BlockParser.parseTransaction(transactionsCell[i]);
          if (!compareBytes(tr.account_addr, address.hashPart)) {
            throw Error('Invalid account address in transaction list');
          }
          if (!tr.lt.eq(last_lt)) {
            throw Error('Invalid lt in transaction list');
          }
          last_hash = tr.prev_trans_hash;
          last_lt = tr.prev_trans_lt;
          transactionList.push(tr);
          blockIdList.push(res.ids[i]);
        }

        if (checkLast) {
          if (!compareBytes(last_hash, new Uint8Array(32)) || !last_lt.eq(new BN(0))) {
            console.warn('Obtained less transactions than required');
          }

          result.ok = true;
          result.transactionList = transactionList;
          result.blockIdList = blockIdList;
      
          return transactionList;
        }
      }

      result.ok = true;
      result.transactionList = transactionList;
      result.blockIdList = blockIdList;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get transactions:', e);
    }
    return result;
  }

  isMasterchain() {

  }

  id() {
      return this.id;
  }

  copy() {

  }

  isValidated() {

  }

  isLoaded() {

  }

  rawInfo() {

  }

  validatorSigns() {

  }

  shardGetFromHashmap(m, wc, addr) {
    if (!m.map.has(wc.toString()))
      return;

    let bt = m.map.get(wc.toString());
    const binAddr = bytesToBinString(addr);
    for (let i = 0; i < binAddr.length; i++) {
      if (bt.type === "fork") {
        if (binAddr[i] === '0') {
          bt = bt.left;
        } else {
          bt = bt.right;
        }
      } else if (bt.type === "leaf") {
        return bt.leaf;
      } else {
        return;
      }
    }

  }

  // state stuff

  async getAccountState(accountAddr) {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");

      const address = new Address(accountAddr);

      let state = await this.provider.getAccountState(this.id, accountAddr);
      if (!state)
        throw Error("Cannot get account state");

      let blockId;
      if (address.wc !== -1) {
        if (state.shard_proof.length === 0)
          throw Error('No shard proof');

          const shardProofCell = await Cell.fromBoc(state.shard_proof);

          if (shardProofCell.length !== 2)
            throw Error("Invalid block root");

          // check root_hash
          if (shardProofCell[0].type !== Cell.MerkleProofCell ||
              !compareBytes(new Uint8Array(this.id.root_hash.buffer), shardProofCell[0].refs[0].getHash(0)))
            throw Error("Invalid root_hash of block");

          const shardBlockHeader = BlockParser.parseBlock(shardProofCell[0].refs[0]);

          // check other
          if (shardBlockHeader.info.seq_no !== this.id.seqno)
            throw Error("Invalid seqno");
          if (!this.id.compareShard(shardBlockHeader.info.shard.shard))
            throw Error("Invalid shard");
          if (shardBlockHeader.info.shard.workchain_id !== this.id.workchain)
            throw Error("Invalid workchain");
          if (shardBlockHeader.info.not_master != (this.id.workchain !== -1))
            throw Error("Invalid not_master");

          // extract MC ShardState hash
          const mcShardStateHash = shardBlockHeader.state_update.new_hash;

          // check MC ShardState hash
          if (shardProofCell[1].type !== Cell.MerkleProofCell ||
              !compareBytes(mcShardStateHash, shardProofCell[1].refs[0].getHash(0)))
            throw Error("Invalid shard info hash");

          const mcShardState = BlockParser.parseShardState(shardProofCell[1].refs[0]);

          const shardDescr = this.shardGetFromHashmap(mcShardState.custom.shard_hashes, address.wc, address.hashPart);
          if (!shardDescr)
            throw Error('No account shard found');

          blockId = new BlockId({
            workchain: address.wc,
            seqno: shardDescr.seq_no,
            file_hash: shardDescr.file_hash,
            root_hash: shardDescr.root_hash
          });

          result.mcBlockHeader = shardBlockHeader;
          result.mcShardState = mcShardState;
      }
      else {
        blockId = this.id;
      }

      // state.proof ->
      // [0] : from Block (shardblk) to ShardState (not incl, hash only)
      // [1] : from ShardState/ShardStateUnsplit to ShardAccount (incl.) and Account (not incl, hash only) -> state.state
      const blockProofCell = await Cell.fromBoc(state.proof);

      if (blockProofCell.length !== 2)
        throw Error("Invalid shard root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(blockId.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash of shard block");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== blockId.seqno)
        throw Error("Invalid seqno");
      //if (!blockId.compareShard(blockHeader.info.shard.shard))
      //  throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== blockId.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (blockId.workchain !== -1))
        throw Error("Invalid not_master");

      // extract ShardState hash
      const shardStateHash = blockHeader.state_update.new_hash;

      // check ShardState hash
      if (blockProofCell[1].type !== Cell.MerkleProofCell ||
          !compareBytes(shardStateHash, blockProofCell[1].refs[0].getHash(0)))
        throw Error("Invalid shard info hash");

      const shardState = BlockParser.parseShardState(blockProofCell[1].refs[0]);
      const accountKey = new BN(address.hashPart);

      if (!shardState.accounts.map.has(accountKey.toString(16))) {
        // shard state does not contain exact account hash
        // lets check, if account is prunned from hashmap
        const accountBin = bytesToBinString(address.hashPart);
        for (let i in shardState.accounts.prunned) {
          if (accountBin.startsWith(shardState.accounts.prunned[i])) {
            throw Error("Invalid account state proof!");
          }
        }
        // account really doesnt exist

        result.ok = true;
        result.blockId = blockId;
        result.blockHeader = blockHeader;
        result.shardState = shardState;
        result.account = {_:"Account", type: 'none'};
        result.last_trans_hash = new Uint8Array(32);
        result.last_trans_lt = new BN(0);

        return result;
      }

      const accountValue = shardState.accounts.map.get(accountKey.toString(16)).value;
      const accountCell = (await Cell.fromBoc(state.state))[0];

      // get & check account hash
      if (accountCell.type !== Cell.OrdinaryCell ||
          !compareBytes(accountCell.getHash(0), accountValue.account.getHash(0)))
        throw Error("Invalid account hash");

      const account = await BlockParser.parseAccount(accountCell);

      result.ok = true;
      result.blockId = blockId;
      result.blockHeader = blockHeader;
      result.shardState = shardState;
      result.account = account;
      result.last_trans_hash = accountValue.last_trans_hash;
      result.last_trans_lt = accountValue.last_trans_lt;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get account state', e);
    }
    return result;
  }

  async getConfig(configNum) {
    let result = {ok:false};
    try {
      if (!this.id)
        throw Error("Block has no id");
      if (this.id.workchain !== -1)
        throw Error("Block is not a masterchain");

      let res;
      if (configNum === undefined)
        res = await this.provider.getConfigAll(this.id);
      else
        res = await this.provider.getConfigParams(this.id, [configNum]);
      if (!res)
        throw Error("empty answer");

      const blockProofCell = await Cell.fromBoc(res.state_proof);
      // [0] Block -> ShardState

      if (blockProofCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(this.id.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== this.id.seqno)
        throw Error("Invalid seqno");
      if (!this.id.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== this.id.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (this.id.workchain !== -1))
        throw Error("Invalid not_master");

      // extract MC ShardState hash
      const mcShardStateHash = blockHeader.state_update.new_hash;

      const configProofCell = await Cell.fromBoc(res.config_proof);
      // [0] ShardState -> config

      // check MC ShardState hash
      if (configProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(mcShardStateHash, configProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid config proof hash");

      const mcState = BlockParser.parseShardState(configProofCell[0].refs[0]);

      if (configNum === undefined) {
        return mcState.custom.config;
      }

      if (!mcState.custom.config.config.map.has(configNum.toString(16))) {
        let configBin = configNum.toString(2);
        while (configBin.length < 32) {configBin = "0" + configBin;}
        for (let i in mcState.custom.config.config.prunned) {
          if (configBin.startsWith(mcState.custom.config.config.prunned[i])) {
            throw Error("Invalid config proof!");
          }
        }
        // config really doesnt exist
        result.ok = true;
        result.blockHeader = blockHeader;
        result.shardState = mcState;
        result.config = null;
        result.config_addr = mcState.custom.config.config_addr;

        return result;
      }

      const config = mcState.custom.config.config.map.get(configNum.toString(16));

      result.ok = true;
      result.blockHeader = blockHeader;
      result.shardState = mcState;
      result.config = config;
      result.config_addr = mcState.custom.config.config_addr;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get config:', e);
    }
    return result;
  }

}

module.exports = {Block};