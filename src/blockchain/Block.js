const {Cell, Address} = require("../types");
const {BN, nacl, sha256, sha512, crc16, crc32c, compareBytes, base64ToBytes, bytesToBinString, bytesToHex, concatBytes, stringToArray} = require("../utils");
const {BlockParser} = require("./BlockParser");
const {BlockId} = require("./BlockId");


/**
 * Main BlockAPI class. <br>
 * Examples in test/test-blockapi.js
 */
class Block {

  /**
   * Creates BlockAPI class
   * 
   * @constructor
   * @param {Object} provider Provider object
   * @param {Object} storage Storage object
   */
  constructor(provider, storage) {
    this.provider = provider || Block._provider;
    this.storage = storage || Block._storage;
    this.zero_state = new BlockId(this.provider.getZeroState());
  }

  /**
   * Tries to run method function several times
   * 
   * @param {number} retry Retry count
   * @param {Function} method Async BlockAPI function
   * @returns {Promise<{ok:boolean, reason:(Error|undefined)}>} Function result object
   */
  async callMethod(retry, method) {
    let res;
    for (let i = 0; i < retry; i++) {
      res = await method();
      if (res.ok)
        return res;
    }
    return res;
  }

  /**
   * Gets latest known block id
   * 
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), id:(BlockId|undefined), clientDiff:(number|undefined), serverDiff:(number|undefined), tonDiff:(number|undefined)}>} result
   */
  async getLatestId() {
    let result = {ok:false};
    try {
      let res = await this.provider.getLatestBlockId();
      if (!res)
        throw Error("empty answer");

      result.ok = true;
      result.id = res.blockId;
      result.clientDiff = res.clientDiff;
      result.serverDiff = res.serverDiff;
      result.tonDiff = res.tonDiff;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get latest block:', e);
    }
    return result;
  }

  /**
   * Tries to lookup block by id, lt or time
   * 
   * @param {BlockId} blockId? Block id to lookup
   * @param {BN} lt? Block logical time
   * @param {number} utime? Block create unix time
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), id:(BlockId|undefined), blockHeader:(Object|undefined)}>} Query result
   */
  async lookup(blockId, lt, utime) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");

      let res = await this.provider.lookupBlock(blockId, lt, utime);
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
      if (!(lt || utime) && blockHeader.info.seq_no !== blockId.seqno)
        throw Error("Invalid seqno");
      if (!blockId.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== blockId.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (blockId.workchain !== -1))
        throw Error("Invalid not_master");
      if (utime && blockHeader.info.gen_utime !== utime)
        throw Error("Invalid utime");
      if (lt && (lt.lt(blockHeader.info.start_lt) || lt.gt(blockHeader.info.end_lt)))
        throw Error("Invalid lt");

      // save
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

  /**
   * Gets header of block
   * 
   * @param {BlockId} blockId Block id object
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), blockHeader:(Object|undefined)}>} 
   */
  async getHeader(blockId) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");

      let res = await this.provider.getBlockHeader(blockId);
      if (!res)
        throw Error("empty answer");

      const blockProofCell = await Cell.fromBoc(res.header_proof);

      if (blockProofCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(blockId.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== blockId.seqno)
        throw Error("Invalid seqno");
      if (!blockId.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== blockId.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (blockId.workchain !== -1))
        throw Error("Invalid not_master");

      result.ok = true;
      result.blockHeader = blockHeader;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot lookup block:', e);
    }
    return result;
  }

  /**
   * Gets block data
   * 
   * @param {BlockId} blockId Block id object
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), block:(Object|undefined)}>} 
   */
  async getData(blockId) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");

      let res = await this.provider.getBlock(blockId);
      if (!res)
        throw Error("Cannot get block data");

      // check file_hash
      const hash = await sha256(res.data);
      if (!compareBytes(new Uint8Array(blockId.file_hash.buffer), new Uint8Array(hash)))
        throw Error("Invalid file_hash");

      const blockCell = await Cell.fromBoc(res.data);

      if (blockCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (!compareBytes(new Uint8Array(blockId.root_hash.buffer), blockCell[0].getHash(0)))
        throw Error("Invalid root_hash");

      const block = BlockParser.parseBlock(blockCell[0]);

      // check other
      if (block.info.seq_no !== blockId.seqno)
        throw Error("Invalid seqno");
      if (!blockId.compareShard(block.info.shard.shard))
        throw Error("Invalid shard");
      if (block.info.shard.workchain_id !== blockId.workchain)
        throw Error("Invalid workchain");
      if (block.info.not_master != (blockId.workchain !== -1))
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

  _validators_crc32c(nodes, cc_seqno) {
    const tot_size = 1 + 1 + 1 + nodes.length * (8 + 2 + 8);
    let buff = new Uint32Array(tot_size);
    buff[0] = 0x901660ED;   // -1877581587
    buff[1] = cc_seqno;
    buff[2] = nodes.length;
    for (let i = 0; i < nodes.length; i++) {
      const key = new Uint32Array(nodes[i].key.buffer);
      buff.set(key, 3 + i*(8+2+8));
      let weight8 = new Uint8Array(nodes[i].weight.toArray('le'));
      if (weight8.length < 8) {
          let append = new Uint8Array(8 - weight8.length);
          weight8 = concatBytes(weight8, append);
      }
      const weight = new Uint32Array(weight8.buffer);
      buff.set(weight, 3 + i*(8+2+8) + 8);
      const addr = new Uint32Array(nodes[i].addr.buffer);
      buff.set(addr, 3 + i*(8+2+8) + 8 + 2);
    }
    return (new Uint32Array(crc32c(new Uint8Array(buff.buffer)).buffer))[0];
  }

  async _compute_validators_set(gen, validators, count, shuffle_mc_val) {
    let nodes = [];
    if (shuffle_mc_val) {
      // shuffle mc validators from the head of the list
      let idx = [];
      for (let i = 0; i < count; i++)
        idx.push(0);
      for (let i = 0; i < count; i++) {
        let j = (await gen.next_ranged(i + 1)).toNumber();  // number 0 .. i
        idx[i] = idx[j];
        idx[j] = i;
      }
      for (let i = 0; i < count; i++) {
        const v = validators.get(idx[i].toString(16));
        nodes.push({key: v.public_key.pubkey, weight: v.weight, addr: v.adnl_addr ? v.adnl_addr : new Uint8Array(32)});
      }
    } else {
      // simply take needed number of validators from the head of the list
      for (let i = 0; i < count; i++) {
        const v = validators.get(i.toString(16));
        nodes.push({key: v.public_key.pubkey, weight: v.weight, addr: v.adnl_addr ? v.adnl_addr : new Uint8Array(32)});
      }
    }
    return nodes;
  }

  async _compute_node_id_short(ed25519_pubkey) {
    // pub.ed25519#4813b4c6 key:int256 = PublicKey;
    let pk = new Uint8Array(36);
    pk.set([0xc6, 0xb4, 0x13, 0x48], 0);
    pk.set(ed25519_pubkey, 4);
    return await sha256(pk);
  }

  /**
   * Validates block by Merkle proofs
   * 
   * @param {BlockId} blockId Block id object
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), valid:(boolean|undefined)}>} 
   */
  async validate(blockId) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");

      let knownBlocks = this.storage.getKnownBlocks();
      //if (!knownBlocks["0"]) {
      //  this.storage.addBlock(this.zero_state);
      //}

      if (knownBlocks[blockId.seqno]) {
        result.ok = true;
        result.valid = true;
        return result;
      }

      let from = null;
      for (var key in knownBlocks) {
        const value = knownBlocks[key];
        if (!from || (Math.abs(value.seqno - blockId.seqno) < Math.abs(value.seqno - from.seqno))) {
          from = value;
        }
      }

      if (!from)
        throw Error("No known blocks");

      // main validation cycle
      for (let i = 0; i < 10000; i++) {

        //console.log('request from', from, 'to', blockId);

        let blockProof = await this.provider.getBlockProof(from, blockId);

        //console.log('got from', blockProof.from, 'to', blockProof.to);

        if (!from.compare(blockProof.from))
          throw Error("Invalid response");

        if (blockProof.from.workchain !== -1 || !blockId.compareShard(blockProof.from.shard) ||
            blockProof.to.workchain !== -1 || !blockId.compareShard(blockProof.to.shard))
          throw Error("BlockProof must have both source and destination blocks in the masterchain");

        if (blockProof.steps.length < 1)
          throw Error("BlockProof length 0");

        let curr = blockProof.from;
        for (let k of blockProof.steps) {
          if (k['_'] !== 'liteServer.blockLinkBack' && k['_'] !== 'liteServer.blockLinkForward')
            throw Error("Invalid BlockProofLink");

          const fwd = k['_'] === 'liteServer.blockLinkForward';

          if (!curr.compare(k.from))
            throw Error("Invalid BlockProof chain");

          if (k.from.workchain !== -1 || !curr.compareShard(k.from.shard) ||
              k.to.workchain !== -1 || !curr.compareShard(k.to.shard))
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
          //let utime;
          let blockFrom;
          let blockTo;
          if (k.from.seqno > 0) {
            blockFrom = BlockParser.checkBlockHeader(proofCell[0], k.from);
            if (!fwd) {
              // current ShardState of a block
              state_hash = blockFrom.state_update.new_hash; //block.state_update.refs[1].getHash(0);
            }
          } else {
              // check zerostate
              if (proofCell[0].type != 3 || !compareBytes(proofCell[0].refs[0].getHash(0), new Uint8Array(k.from.root_hash.buffer)))
                throw Error("Incorrect zerostate root hash");
          }
          if (k.to.seqno > 0) {
            const destProofCell = await Cell.fromBoc(dest_proof);
            blockTo = BlockParser.checkBlockHeader(destProofCell[0], k.to);
            if (Boolean(blockTo.info.key_block) !== k.to_key_block)
              throw Error("Incorrect is_key_block value");

            //utime = blockTo.info.gen_utime;
          }
          if (!fwd) {
            // check a backward link
            const stateProofCell = (await Cell.fromBoc(k.state_proof))[0];
            if (stateProofCell.type != 3 || !compareBytes(state_hash, stateProofCell.refs[0].getHash(0)))
              throw Error("BlockProofLink contains a state proof for with incorrect root hash");

            const stateProof = BlockParser.parseShardState(stateProofCell.refs[0]);
            if (stateProof.custom.prev_blocks._ !== 'HashmapAugE')
              throw Error('no prev blocks found');
            if (!stateProof.custom.prev_blocks.map.has(k.to.seqno.toString(16)))
              throw Error('no prev blocks found');
            const prevBlock = stateProof.custom.prev_blocks.map.get(k.to.seqno.toString(16));

            if (prevBlock.value.blk_ref.seq_no !== k.to.seqno)
              throw Error('Invalid dest seqno');

            if (!compareBytes(prevBlock.value.blk_ref.file_hash, new Uint8Array(k.to.file_hash.buffer)))
              throw Error('Invalid dest file_hash');

            if (!compareBytes(prevBlock.value.blk_ref.root_hash, new Uint8Array(k.to.root_hash.buffer)))
              throw Error('Invalid dest file_hash');

          } else {
            // check a forward link
            let config;
            //const gen_utime = blockTo.info.gen_utime;
            const gen_catchain_seqno = blockTo.info.gen_catchain_seqno;
            const gen_validator_list_hash_short = blockTo.info.gen_validator_list_hash_short;

            if (k.from.seqno === 0) {
              // zerostate
              const stateConfig = BlockParser.parseShardState(proofCell[0].refs[0]);
              config = stateConfig.custom.config;
            } else {
              // key block
              config = blockFrom.extra.custom.config;
            }

            let validators;
            // configs 35, 34
            if (config.config.map.has('23')) {
              validators = config.config.map.get('23').cur_temp_validators;
            }
            else {
              validators = config.config.map.get('22').cur_validators;
            }
            if (!validators || validators.list.map.length === 0)
              throw Error('Cannot extract configuration from source key block');

            let catchainConfig = config.config.map.get('1c').catchain;
            const count = Math.min(validators.main, validators.total);
            const prng = new ValidatorSetPRNG(BlockId.shardMasterchain(), -1, gen_catchain_seqno);
            const nodes = await this._compute_validators_set(prng, validators.list.map, count, catchainConfig.shuffle_mc_validators);
            const validator_list_hash_short = this._validators_crc32c(nodes, gen_catchain_seqno);
            if (validator_list_hash_short !== gen_validator_list_hash_short)
              throw Error('Computed validator set for block is invaid');
            if (validator_list_hash_short !== (new Uint32Array([k.signatures.validator_set_hash]))[0])
              throw Error('Computed validator set for block is invaid');

            let to_sign = new Uint8Array(68);
            to_sign.set([0x70, 0x6e, 0x0b, 0xc5], 0);  // ton.blockId root_cell_hash:int256 file_hash:int256 = ton.BlockId;
            to_sign.set(new Uint8Array(k.to.root_hash.buffer), 4);
            to_sign.set(new Uint8Array(k.to.file_hash.buffer), 36);

            let total_weight = new BN(0);
            let signed_weight = new BN(0);
            let seen = [];
            let node_list = {};
            for (let j = 0; j < nodes.length; j++) {
              total_weight.iadd(nodes[j].weight);
              const shord_id = new Uint8Array(await this._compute_node_id_short(nodes[j].key));
              node_list[bytesToHex(shord_id)] = nodes[j];
            }

            for (let j = 0; j < k.signatures.signatures.length; j++) {
              const signature = k.signatures.signatures[j];
              const s = bytesToHex(new Uint8Array(signature.node_id_short.buffer));
              if (node_list[s] === undefined)
                throw Error('signature set contains unknown NodeIdShort');
              if (seen[signature.signature.toString()] !== undefined)
                throw Error('signature set contains duplicate signature');
              seen.push(signature.signature.toString());
              // check one signature
              
              //const res = verify_signature(to_sign, k.signatures.signatures[j].signature, node_list[s].key);
              const res = nacl.sign.detached.verify(to_sign, signature.signature, node_list[s].key);
              if (!res)
                throw Error('signature check failed');

              signed_weight.iadd(node_list[s].weight);
              if (signed_weight.gt(total_weight)) {
                break;
              }
            }
            // final
            signed_weight.imul(new BN(3));
            total_weight.imul(new BN(2));
            if (signed_weight.lte(total_weight))
              throw Error("insufficient total signature weight");
          }


          curr = k.to;

          if (k.to_key_block)
            this.storage.addBlock(k.to);
        }
        
        from = blockProof.to;

        if (blockId.compare(from)) {
          break;
        }
      }

      result.ok = true;
      result.valid = true;

    } catch(e) {
      result.reason = e;
      console.log(e);
    }
    this.storage.save();
    return result;
  }

  /**
   * Gets shards info
   * 
   * @param {BlockId} blockId Block id object
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), shardHashes:(Object|undefined), blockHeader:(Object|undefined), shardState:(Object|undefined)}>} 
   */
  async getShards(blockId) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");
      if (blockId.workchain !== -1)
        throw Error("Block is not a masterchain");

      let res = await this.provider.getAllShardsInfo(blockId);
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
          !compareBytes(new Uint8Array(blockId.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== blockId.seqno)
        throw Error("Invalid seqno");
      if (!blockId.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== blockId.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (blockId.workchain !== -1))
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

  /**
   * Gets transaction list
   * 
   * @param {number} maxCount Maximum number of transactions
   * @param {Address | string} accountAddr Account address
   * @param {BN} lt Logical time of first transaction
   * @param {Uint32Array} hash Hash of first transaction
   * @param {BN} to_lt Logical time of last transaction (not including)
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), transactionList:(Object|undefined), blockIdList:(Object|undefined)}>} 
   */
  async getTransactions(maxCount, accountAddr, lt, hash, to_lt) {
    let result = {ok:false};
    try {
      if (to_lt !== undefined && lt.lte(to_lt))
        throw Error('lt must be > than to_lt');

      const address = new Address(accountAddr);

      let last_lt = lt;
      let last_hash = hash;
      let transactionList = [];
      let blockIdList = [];

      let requests = Math.ceil(maxCount/10);
      let pending = maxCount;
      let to_lt_reached = false;

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
      
          return result;
        }

        if (!res) 
          throw Error("empty answer");

        if (res.transactions.length === 0) {
          console.warn('Obtained less transactions than required');

          result.ok = true;
          result.transactionList = transactionList;
          result.blockIdList = blockIdList;
      
          return result;
        }

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
          if (to_lt !== undefined && last_lt.lte(to_lt)) {
            to_lt_reached = true;
            break;
          }
        }

        if (to_lt_reached || last_lt.lte(new BN(0)))
          break;

        if (checkLast) {
          if (!compareBytes(last_hash, new Uint8Array(32)) || !last_lt.eq(new BN(0))) {
            console.warn('Obtained less transactions than required');
          }

          result.ok = true;
          result.transactionList = transactionList;
          result.blockIdList = blockIdList;
      
          return result;
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


  validatorSigns() {

  }

  _shardGetFromHashmap(m, wc, addr) {
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

  /**
   * Gets account state
   * 
   * @param {BlockId} blockId Block id object
   * @param {Address | string} accountAddr Account address
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), account:(Object|undefined), blockHeader:(Object|undefined), shardState:(Object|undefined), lastTransHash:(Uint32Array|undefined), lastTransLt:(BN|undefined)}>} 
   */
  async getAccountState(blockId, accountAddr) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");

      const address = new Address(accountAddr);

      let state = await this.provider.getAccountState(blockId, accountAddr);
      if (!state)
        throw Error("Cannot get account state");

      let shardBlockId;
      if (address.wc !== -1) {
        if (state.shard_proof.length === 0)
          throw Error('No shard proof');

          const shardProofCell = await Cell.fromBoc(state.shard_proof);

          if (shardProofCell.length !== 2)
            throw Error("Invalid block root");

          // check root_hash
          if (shardProofCell[0].type !== Cell.MerkleProofCell ||
              !compareBytes(new Uint8Array(blockId.root_hash.buffer), shardProofCell[0].refs[0].getHash(0)))
            throw Error("Invalid root_hash of block");

          const shardBlockHeader = BlockParser.parseBlock(shardProofCell[0].refs[0]);

          // check other
          if (shardBlockHeader.info.seq_no !== blockId.seqno)
            throw Error("Invalid seqno");
          if (!blockId.compareShard(shardBlockHeader.info.shard.shard))
            throw Error("Invalid shard");
          if (shardBlockHeader.info.shard.workchain_id !== blockId.workchain)
            throw Error("Invalid workchain");
          if (shardBlockHeader.info.not_master != (blockId.workchain !== -1))
            throw Error("Invalid not_master");

          // extract MC ShardState hash
          const mcShardStateHash = shardBlockHeader.state_update.new_hash;

          // check MC ShardState hash
          if (shardProofCell[1].type !== Cell.MerkleProofCell ||
              !compareBytes(mcShardStateHash, shardProofCell[1].refs[0].getHash(0)))
            throw Error("Invalid shard info hash");

          const mcShardState = BlockParser.parseShardState(shardProofCell[1].refs[0]);

          const shardDescr = this._shardGetFromHashmap(mcShardState.custom.shard_hashes, address.wc, address.hashPart);
          if (!shardDescr)
            throw Error('No account shard found');

          shardBlockId = new BlockId({
            workchain: address.wc,
            seqno: shardDescr.seq_no,
            file_hash: shardDescr.file_hash,
            root_hash: shardDescr.root_hash
          });

          result.mcBlockHeader = shardBlockHeader;
          result.mcShardState = mcShardState;
      }
      else {
        shardBlockId = blockId;
      }

      // state.proof ->
      // [0] : from Block (shardblk) to ShardState (not incl, hash only)
      // [1] : from ShardState/ShardStateUnsplit to ShardAccount (incl.) and Account (not incl, hash only) -> state.state
      const blockProofCell = await Cell.fromBoc(state.proof);

      if (blockProofCell.length !== 2)
        throw Error("Invalid shard root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(shardBlockId.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash of shard block");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== shardBlockId.seqno)
        throw Error("Invalid seqno");
      //if (!shardBlockId.compareShard(blockHeader.info.shard.shard))
      //  throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== shardBlockId.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (shardBlockId.workchain !== -1))
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
        result.blockId = shardBlockId;
        result.blockHeader = blockHeader;
        result.shardState = shardState;
        result.account = {_:"Account", type: 'none'};
        result.lastTransHash = new Uint8Array(32);
        result.lastTransLt = new BN(0);

        return result;
      }

      const accountValue = shardState.accounts.map.get(accountKey.toString(16)).value;
      const accountCell = (await Cell.fromBoc(state.state))[0];

      const accountHash = accountValue.account._ === "Cell" ? accountValue.account.getHash(0) : accountValue.account.cell.getHash(0);

      // get & check account hash
      if (accountCell.type !== Cell.OrdinaryCell ||
          !compareBytes(accountCell.getHash(0), accountHash))
        throw Error("Invalid account hash");

      const account = await BlockParser.parseAccount(accountCell);

      result.ok = true;
      result.blockId = blockId;
      result.blockHeader = blockHeader;
      result.shardState = shardState;
      result.account = account;
      result.lastTransHash = accountValue.last_trans_hash;
      result.lastTransLt = accountValue.last_trans_lt;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get account state', e);
    }
    return result;
  }

  /**
   * Gets blockchain config
   * 
   * @param {BlockId} blockId Block id object
   * @param {number} configNum? Config number (All if not specified)
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), configParam:(Object|undefined), configAddr:(Uint8Array|undefined), blockHeader:(Object|undefined), shardState:(Object|undefined)}>} 
   */
  async getConfig(blockId, configNum) {
    let result = {ok:false};
    try {
      if (!blockId)
        throw Error("Block has no id");
      if (blockId.workchain !== -1)
        throw Error("Block is not a masterchain");

      let res;
      if (configNum === undefined)
        res = await this.provider.getConfigAll(blockId);
      else
        res = await this.provider.getConfigParams(blockId, [configNum]);
      if (!res)
        throw Error("empty answer");

      const blockProofCell = await Cell.fromBoc(res.state_proof);
      // [0] Block -> ShardState

      if (blockProofCell.length !== 1)
        throw Error("Invalid root");

      // check root_hash
      if (blockProofCell[0].type !== Cell.MerkleProofCell ||
          !compareBytes(new Uint8Array(blockId.root_hash.buffer), blockProofCell[0].refs[0].getHash(0)))
        throw Error("Invalid root_hash");

      const blockHeader = BlockParser.parseBlock(blockProofCell[0].refs[0]);

      // check other
      if (blockHeader.info.seq_no !== blockId.seqno)
        throw Error("Invalid seqno");
      if (!blockId.compareShard(blockHeader.info.shard.shard))
        throw Error("Invalid shard");
      if (blockHeader.info.shard.workchain_id !== blockId.workchain)
        throw Error("Invalid workchain");
      if (blockHeader.info.not_master != (blockId.workchain !== -1))
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
        result.ok = true;
        result.blockHeader = blockHeader;
        result.shardState = mcState;
        result.configParams = mcState.custom.config;
        return result;
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
        result.configParam = null;
        result.configAddr = mcState.custom.config.config_addr;

        return result;
      }

      const config = mcState.custom.config.config.map.get(configNum.toString(16));

      result.ok = true;
      result.blockHeader = blockHeader;
      result.shardState = mcState;
      result.configParam = config;
      result.configAddr = mcState.custom.config.config_addr;

      return result;
    } catch(e) {
      result.reason = e;
      console.log('Cannot get config:', e);
    }
    return result;
  }

  compute_method_id(method) {
    let method_id;
    try {
      if (method.startsWith('0x'))
        method_id = new BN(method.replace('0x', ''), 16);
      else
        method_id = new BN(method, 10);
    } catch (e) {
      let arr = stringToArray(method);
      let crc = crc16(arr);
      crc = new Uint8Array([crc[1], crc[0]]);
      method_id = new BN((new Uint16Array(crc.buffer))[0] | 0x10000);
    }
    return method_id;
  }

  /**
   * Runs get method on remote node
   * 
   * @todo Make proof checks
   * @param {BlockId} blockId Block id object
   * @param {Address | string} accountAddr Account address
   * @returns {Promise<{ok:boolean, reason:(Error|undefined), smc:(Object|undefined)}>} 
   */
  async runSmcMethod(blockId, accountAddr, method, params) {
    console.warn('Incomplete, do not use');
    let result = {ok:false};
    try {
      const address = new Address(accountAddr);
      const method_id = this.compute_method_id(method);

      let res = await this.provider.runSmcMethod(blockId, address, method_id, params);
      if (!res)
        throw Error("Cannot get account state");

      result.smc = res;
      result.ok = true;
    } catch (e) {
      result.reason = e;
      console.log('Cannot run smc method:', e);
    }
    return result;
  }
  
  async sendMessage(message) {
    let result = {ok:false};
    try {
      if (typeof message == 'string')
        message = base64ToBytes(message);

      let res = await this.provider.sendMessage(message);
      if (!res)
        throw Error("Cannot send message");

      result.ok = true;
    } catch (e) {
      result.reason = e;
      console.log('Cannot send message:', e);
    }
    return result;
  }

}

function bswap32(x) {
  return new Uint8Array([x[3], x[2], x[1], x[0]]);
}
//function bswap64(x) {
//  return new Uint8Array([x[7], x[6], x[5], x[4], x[3], x[2], x[1], x[0]]);
//}

class ValidatorSetPRNG {
  constructor(shard, wc, cc_seqno) {
    this.pos = 0;
    this.limit = 0;
    this.hash = new Uint8Array(64);
    /*
      unsigned char seed[32];  // seed for validator set computation, set to zero if none
      td::uint64 shard;
      td::int32 workchain;
      td::uint32 cc_seqno;
    */
    this.data = new Uint8Array(32+8+4+4);
    /*
      shard(td::bswap64(shard_id.shard))
      workchain(td::bswap32(shard_id.workchain))
      cc_seqno(td::bswap32(cc_seqno_)
    */
    let shardA = shard.toArray('be', 8);
    let workchainA = new Uint8Array((new Uint32Array([wc])).buffer);
    let cc_seqnoA = new Uint8Array((new Uint32Array([cc_seqno])).buffer);
    this.data.set(shardA, 32);
    this.data.set(bswap32(workchainA), 32+8);
    this.data.set(bswap32(cc_seqnoA), 32+8+4);
  }

  incr_seed() {
    let seed = this.data;
    for (let i = 31; i >= 0 && !++(seed[i]); --i);
  }

  async next_ulong() {
    if (this.pos < this.limit) {
      let res = this.hash.slice(this.pos*8, this.pos*8 + 8);
      this.pos++;
      return new BN(res, 10, 'be');
    }
    this.hash = new Uint8Array(await sha512(this.data));
    this.incr_seed();
    this.pos = 1;
    this.limit = 8;
    let res = this.hash.slice(0, 8);
    return new BN(res, 10, 'be');
  }

  async next_ranged(range) {
    let y = await this.next_ulong();
    y.imul(new BN(range));
    y.ishrn(64);
    return y;
  }
}

module.exports = {Block};