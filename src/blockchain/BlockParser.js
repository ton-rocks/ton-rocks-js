const {Cell} = require("../types/Cell");
const {Hashmap, HashmapE, HashmapAug, HashmapAugE} = require("../types/Hashmap");
const {BN, compareBytes} = require("../utils");
const {
  loadUint,
  loadUint8,
  loadUint16,
  loadUint32,
  loadUint64,
  loadInt8,
  // eslint-disable-next-line no-unused-vars
  loadInt16,
  loadInt32,
  loadBit,
  loadBits,
  loadBool,
  loadUintLeq,
  // eslint-disable-next-line no-unused-vars
  loadUintLess,
  loadVarUInteger,
  loadGrams,
  loadRefIfExist,
  loadMaybe,
  loadMaybeRef,
  loadEither
} = require("./BlockUtils");


/**
 * Loads Hashmap
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {number} n Hashmap dimention
 * @param {Function} f Function for leaf
 * @returns {Hashmap}
 */
function loadHashmap(cell, t, n, f) {
  let data = new Hashmap(n, f);
  data.deserialize(cell, t);
  return data;
}

/**
 * Loads HashmapE
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {number} n Hashmap dimention
 * @param {Function} f Function for leaf
 * @returns {HashmapE}
 */
function loadHashmapE(cell, t, n, f) {
  let data = new HashmapE(n, f);
  data.deserialize(cell, t);
  return data;
}

/**
 * Loads HashmapAug
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {number} n Hashmap dimention
 * @param {Function} f1 Function for value leaf
 * @param {Function} f2 Function for extra leaf
 * @returns {HashmapAug}
 */
function loadHashmapAug(cell, t, n, f1, f2) {
  let data = new HashmapAug(n, (c,p) => {return {"extra": f2(c,p), "value": f1(c,p)};});
  data.deserialize(cell, t);
  return data;
}

/**
 * Loads HashmapAugE
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {number} n Hashmap dimention
 * @param {Function} f1 Function for value leaf
 * @param {Function} f2 Function for extra leaf
 * @returns {HashmapAugE}
 */
function loadHashmapAugE(cell, t, n, f1, f2) {
  let data = new HashmapAugE(n, (c,p) => {return {"extra": f2(c,p), "value": f1(c,p)};});
  data.deserialize(cell, t);
  return data;
}


function loadBinTreeR(cell, t, f) {
  let data = {};
  if (loadBit(cell, t) === 0) {
    data.type = "leaf";
    data.leaf = f ? f(cell, t) : null;
    return data;
  }
  else {
    data.type = "fork";
    data.left = loadRefIfExist(cell, t, (c,p) => loadBinTreeR(c, p, f));
    data.right = loadRefIfExist(cell, t, (c,p) => loadBinTreeR(c, p, f));
    return data;
  }
}

/**
 * Loads BinTree  <br>
 * 
 * bt_leaf$0 {X:Type} leaf:X = BinTree X; <br>
 * bt_fork$1 {X:Type} left:^(BinTree X) right:^(BinTree X) <br>
 * = BinTree X;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {Function} f Function for leaf
 * @returns {Object}
 */
function loadBinTree(cell, t, f) {
  let data = loadBinTreeR(cell, t, f);
  data._ = "BinTree";
  return data;
}


/**
 * Loads ConfigParam 0  <br>
 * 
 * _ config_addr:bits256 = ConfigParam 0;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam0(cell, t) {
  let data = {_:"ConfigParam", number: 0};
  data.config_addr = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ConfigParam 1  <br>
 * 
 * _ elector_addr:bits256 = ConfigParam 1;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam1(cell, t) {
  let data = {_:"ConfigParam", number: 1};
  data.elector_addr = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ConfigParam 2  <br>
 * 
 * _ minter_addr:bits256 = ConfigParam 2;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam2(cell, t) {
  let data = {_:"ConfigParam", number: 2};
  data.minter_addr = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ConfigParam 3  <br>
 * 
 * _ fee_collector_addr:bits256 = ConfigParam 3;  // ConfigParam 1 is used if absent
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam3(cell, t) {
  let data = {_:"ConfigParam", number: 3};
  data.fee_collector_addr = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ConfigParam 4  <br>
 * 
 * _ dns_root_addr:bits256 = ConfigParam 4;  // root TON DNS resolver
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam4(cell, t) {
  let data = {_:"ConfigParam", number: 4};
  data.dns_root_addr = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ConfigParam 6  <br>
 * 
 * _ mint_new_price:Grams mint_add_price:Grams = ConfigParam 6;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam6(cell, t) {
  let data = {_:"ConfigParam", number: 6};
  data.mint_new_price = loadGrams(cell, t);
  data.mint_add_price = loadGrams(cell, t);
  return data;
}

/**
 * Loads ConfigParam 7  <br>
 * 
 * _ to_mint:ExtraCurrencyCollection = ConfigParam 7;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam7(cell, t) {
  let data = {_:"ConfigParam", number: 7};
  data.to_mint = loadExtraCurrencyCollection(cell, t);
  return data;
}

/**
 * Loads ConfigParam 8  <br>
 * 
 * _ GlobalVersion = ConfigParam 8;  // all zero if absent
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam8(cell, t) {
  let data = {_:"ConfigParam", number: 8};
  data.version = loadGlobalVersion(cell, t);
  return data;
}

/**
 * Loads ConfigParam 9  <br>
 * 
 * _ mandatory_params:(Hashmap 32 True) = ConfigParam 9;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam9(cell, t) {
  let data = {_:"ConfigParam", number: 9};
  // eslint-disable-next-line no-unused-vars
  data.mandatory_params = loadHashmap(cell, t, 32, (c,p) => true);
  return data;
}

/**
 * Loads ConfigParam 10  <br>
 * 
 * _ critical_params:(Hashmap 32 True) = ConfigParam 10;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam10(cell, t) {
  let data = {_:"ConfigParam", number: 10};
  // eslint-disable-next-line no-unused-vars
  data.critical_params = loadHashmap(cell, t, 32, (c,p) => true);
  return data;
}

/**
 * Loads ConfigProposalSetup  <br>
 * 
 * cfg_vote_cfg#36 min_tot_rounds:uint8 max_tot_rounds:uint8 min_wins:uint8 max_losses:uint8 min_store_sec:uint32 max_store_sec:uint32 bit_price:uint32 cell_price:uint32 = ConfigProposalSetup;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigProposalSetup(cell, t) {
  let data = {_:"ConfigProposalSetup"};
  if (loadUint8(cell, t) !== 0x36)
    throw Error('Not a ConfigProposalSetup');
  data.min_tot_rounds = loadUint8(cell, t);
  data.max_tot_rounds = loadUint8(cell, t);
  data.min_wins = loadUint8(cell, t);
  data.max_losses = loadUint8(cell, t);
  data.min_store_sec = loadUint32(cell, t);
  data.max_store_sec = loadUint32(cell, t);
  data.bit_price = loadUint32(cell, t);
  data.cell_price = loadUint32(cell, t);
  return data;
}

/**
 * Loads ConfigVotingSetup  <br>
 * 
 * cfg_vote_setup#91 normal_params:^ConfigProposalSetup critical_params:^ConfigProposalSetup = ConfigVotingSetup;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigVotingSetup(cell, t) {
  let data = {_:"ConfigVotingSetup"};
  if (loadUint8(cell, t) !== 0x91)
    throw Error('Not a ConfigVotingSetup');
  data.normal_params = loadRefIfExist(cell, t, loadConfigProposalSetup);
  data.critical_params = loadRefIfExist(cell, t, loadConfigProposalSetup);
  return data;
}

/**
 * Loads ConfigParam 11  <br>
 * 
 * _ ConfigVotingSetup = ConfigParam 11;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam11(cell, t) {
  let data = {_:"ConfigParam", number: 11};
  data.setup = loadConfigVotingSetup(cell, t);
  return data;
}

/**
 * Loads WorkchainFormat  <br>
 * 
 * wfmt_basic#1 vm_version:int32 vm_mode:uint64 = WorkchainFormat 1;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadWorkchainFormat1(cell, t) {
  let data = {_:"WorkchainFormat"};
  data.type = 'basic';
  if (loadUint(cell, t, 4).toNumber() !== 0x1)
    throw Error('not a WorkchainFormat');
  data.vm_version = loadInt32(cell, t);
  data.vm_mode = loadUint64(cell, t);
  return data;
}

/**
 * Loads WorkchainDescr  <br>
 * 
 * workchain#a6 enabled_since:uint32 actual_min_split:(## 8)  <br>
 *   min_split:(## 8) max_split:(## 8) { actual_min_split <= min_split } <br>
 * //workchain#a5 enabled_since:uint32 min_split:(## 8) max_split:(## 8) <br>
 * //  { min_split <= max_split } { max_split <= 60 } <br>
 *   basic:(## 1) active:Bool accept_msgs:Bool flags:(## 13) { flags = 0 } <br>
 *   zerostate_root_hash:bits256 zerostate_file_hash:bits256 <br>
 *   version:uint32 format:(WorkchainFormat basic) <br>
 *   = WorkchainDescr;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadWorkchainDescr(cell, t) {
  let data = {_:"WorkchainDescr"};
  if (loadUint8(cell, t) !== 0xa6)
    throw Error('not a WorkchainDescr');
  data.enabled_since = loadUint32(cell, t);
  data.actual_min_split = loadUint(cell, t, 8).toNumber();
  data.min_split = loadUint(cell, t, 8).toNumber();
  data.max_split = loadUint(cell, t, 8).toNumber();
  if (data.actual_min_split > data.min_split)
    throw Error('data.actual_min_split > data.min_split');
  data.basic = loadUint(cell, t, 1).toNumber();
  data.active = loadBool(cell, t);
  data.accept_msgs = loadBool(cell, t);
  data.flags = loadUint(cell, t, 13).toNumber();
  if (data.flags !== 0)
    throw Error('data.flags');
  data.zerostate_root_hash = loadBits(cell, t, 256);
  data.zerostate_file_hash = loadBits(cell, t, 256);
  data.version = loadUint32(cell, t);
  data.format = loadWorkchainFormat1(cell, t);
  return data;
}

/**
 * Loads ConfigParam 12  <br>
 * 
 * _ workchains:(HashmapE 32 WorkchainDescr) = ConfigParam 12;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam12(cell, t) {
  let data = {_:"ConfigParam", number: 12};
  data.workchains = loadHashmapE(cell, t, 32, loadWorkchainDescr);
  return data;
}

/**
 * Loads ComplaintPricing  <br>
 * 
 * complaint_prices#1a deposit:Grams bit_price:Grams cell_price:Grams = ComplaintPricing; 
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadComplaintPricing(cell, t) {
  let data = {_:"ComplaintPricing"};
  if (loadUint8(cell, t) !== 0x1a)
    throw Error('not a ComplaintPricing');
  data.deposit = loadGrams(cell, t);
  data.bit_price = loadGrams(cell, t);
  data.cell_price = loadGrams(cell, t);
  return data;
}

/**
 * Loads ConfigParam 13  <br>
 * 
 * _ ComplaintPricing = ConfigParam 13;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam13(cell, t) {
  let data = {_:"ConfigParam", number: 13};
  data.pricing = loadComplaintPricing(cell, t);
  return data;
}

/**
 * Loads BlockCreateFees  <br>
 * 
 * block_grams_created#6b masterchain_block_fee:Grams basechain_block_fee:Grams <br>
 *   = BlockCreateFees;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadBlockCreateFees(cell, t) {
  let data = {_:"BlockCreateFees"};
  if (loadUint8(cell, t) !== 0x6b)
    throw Error('not a BlockCreateFees');
  data.masterchain_block_fee = loadGrams(cell, t);
  data.basechain_block_fee = loadGrams(cell, t);
  return data;
}

/**
 * Loads ConfigParam 14  <br>
 * 
 * _ BlockCreateFees = ConfigParam 14;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam14(cell, t) {
  let data = {_:"ConfigParam", number: 14};
  data.fees = loadBlockCreateFees(cell, t);
  return data;
}

/**
 * Loads ConfigParam 15  <br>
 * 
 * _ validators_elected_for:uint32 elections_start_before:uint32  <br>
 *   elections_end_before:uint32 stake_held_for:uint32 <br>
 *   = ConfigParam 15;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam15(cell, t) {
  let data = {_:"ConfigParam", number: 15};
  data.validators_elected_for = loadUint32(cell, t);
  data.elections_start_before = loadUint32(cell, t);
  data.elections_end_before = loadUint32(cell, t);
  data.stake_held_for = loadUint32(cell, t);
  return data;
}

/**
 * Loads ConfigParam 16  <br>
 * 
 * _ max_validators:(## 16) max_main_validators:(## 16) min_validators:(## 16)  <br>
 *   { max_validators >= max_main_validators }  <br>
 *   { max_main_validators >= min_validators }  <br>
 *   { min_validators >= 1 } <br>
 *   = ConfigParam 16;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam16(cell, t) {
  let data = {_:"ConfigParam", number: 16};
  data.max_validators = loadUint(cell, t, 16).toNumber();
  data.max_main_validators = loadUint(cell, t, 16).toNumber();
  data.min_validators = loadUint(cell, t, 16).toNumber();
  if (data.max_validators < data.max_main_validators)
    throw Error('data.max_validators < data.max_main_validators');
  if (data.max_main_validators < data.min_validators)
    throw Error('data.max_main_validators < data.min_validators');
  if (data.min_validators < 1)
    throw Error('data.min_validators < 1');
  return data;
}

/**
 * Loads ConfigParam 17  <br>
 * 
 * _ min_stake:Grams max_stake:Grams min_total_stake:Grams max_stake_factor:uint32 = ConfigParam 17;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam17(cell, t) {
  let data = {_:"ConfigParam", number: 17};
  data.min_stake = loadGrams(cell, t);
  data.max_stake = loadGrams(cell, t);
  data.min_total_stake = loadGrams(cell, t);
  data.max_stake_factor = loadUint32(cell, t);
  return data;
}

/**
 * Loads StoragePrices  <br>
 * 
 * _#cc utime_since:uint32 bit_price_ps:uint64 cell_price_ps:uint64  <br>
 *   mc_bit_price_ps:uint64 mc_cell_price_ps:uint64 = StoragePrices;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadStoragePrices(cell, t) {
  let data = {_:"StoragePrices"};
  if (loadUint8(cell, t) !== 0xcc)
    throw Error('not a StoragePrices');
  data.utime_since = loadUint32(cell, t);
  data.bit_price_ps = loadUint64(cell, t);
  data.cell_price_ps = loadUint64(cell, t);
  data.mc_bit_price_ps = loadUint64(cell, t);
  data.mc_cell_price_ps = loadUint64(cell, t);
  return data;
}

/**
 * Loads ConfigParam 18  <br>
 * 
 * _ (Hashmap 32 StoragePrices) = ConfigParam 18;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam18(cell, t) {
  let data = {_:"ConfigParam", number: 18};
  data.prices = loadHashmap(cell, t, 32, loadStoragePrices);
  return data;
}

/**
 * Loads GasLimitsPrices  <br>
 * 
 * gas_prices#dd gas_price:uint64 gas_limit:uint64 gas_credit:uint64  <br>
 *   block_gas_limit:uint64 freeze_due_limit:uint64 delete_due_limit:uint64  <br>
 *   = GasLimitsPrices; <br>
 * 
 * gas_prices_ext#de gas_price:uint64 gas_limit:uint64 special_gas_limit:uint64 gas_credit:uint64  <br>
 *   block_gas_limit:uint64 freeze_due_limit:uint64 delete_due_limit:uint64  <br>
 *   = GasLimitsPrices; <br>
 * 
 * gas_flat_pfx#d1 flat_gas_limit:uint64 flat_gas_price:uint64 other:GasLimitsPrices <br>
 *   = GasLimitsPrices;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadGasLimitsPrices(cell, t) {
  let data = {_:"GasLimitsPrices"};
  let type = loadUint8(cell, t);
  if (type === 0xdd) {
    data.type = '';
    data.gas_price = loadUint64(cell, t);
    data.gas_limit = loadUint64(cell, t);
    data.gas_credit = loadUint64(cell, t);
    data.block_gas_limit = loadUint64(cell, t);
    data.freeze_due_limit = loadUint64(cell, t);
    data.delete_due_limit = loadUint64(cell, t);
    return data;
  }
  else if (type === 0xde) {
    data.type = 'ext';
    data.gas_price = loadUint64(cell, t);
    data.gas_limit = loadUint64(cell, t);
    data.special_gas_limit = loadUint64(cell, t);
    data.gas_credit = loadUint64(cell, t);
    data.block_gas_limit = loadUint64(cell, t);
    data.freeze_due_limit = loadUint64(cell, t);
    data.delete_due_limit = loadUint64(cell, t);
    return data;
  }
  else if (type === 0xd1) {
    data.type = 'pfx';
    data.flat_gas_limit = loadUint64(cell, t);
    data.flat_gas_price = loadUint64(cell, t);
    data.other = loadGasLimitsPrices(cell, t);
    return data;
  }
  throw Error('not a GasLimitsPrices');
}

/**
 * Loads ConfigParam 20  <br>
 * 
 * config_mc_gas_prices#_ GasLimitsPrices = ConfigParam 20;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam20(cell, t) {
  let data = {_:"ConfigParam", number: 20};
  data.prices = loadGasLimitsPrices(cell, t);
  return data;
}

/**
 * Loads ConfigParam 21  <br>
 * 
 * config_gas_prices#_ GasLimitsPrices = ConfigParam 21;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam21(cell, t) {
  let data = {_:"ConfigParam", number: 21};
  data.prices = loadGasLimitsPrices(cell, t);
  return data;
}

/**
 * Loads ParamLimits  <br>
 * 
 * param_limits#c3 underload:# soft_limit:# { underload <= soft_limit } <br>
 *   hard_limit:# { soft_limit <= hard_limit } = ParamLimits;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadParamLimits(cell, t) {
  let data = {_:"ParamLimits"};
  if (loadUint8(cell, t) !== 0xc3)
    throw Error('not a ParamLimits');
  data.underload = loadUint32(cell, t);
  data.soft_limit = loadUint32(cell, t);
  if (data.underload > data.soft_limit)
    throw Error('data.underload > data.soft_limit');
  data.hard_limit = loadUint32(cell, t);
  if (data.soft_limit > data.hard_limit)
    throw Error('data.soft_limit > data.hard_limit');
  return data;
}

/**
 * Loads BlockLimits  <br>
 * 
 * block_limits#5d bytes:ParamLimits gas:ParamLimits lt_delta:ParamLimits <br>
 *   = BlockLimits;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadBlockLimits(cell, t) {
  let data = {_:"BlockLimits"};
  if (loadUint8(cell, t) !== 0x5d)
    throw Error('not a BlockLimits');
  data.bytes = loadParamLimits(cell, t);
  data.gas = loadParamLimits(cell, t);
  data.lt_delta = loadParamLimits(cell, t);
  return data;
}

/**
 * Loads ConfigParam 22  <br>
 * 
 * config_mc_block_limits#_ BlockLimits = ConfigParam 22;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam22(cell, t) {
  let data = {_:"ConfigParam", number: 22};
  data.limits = loadBlockLimits(cell, t);
  return data;
}

/**
 * Loads ConfigParam 23  <br>
 * 
 * config_block_limits#_ BlockLimits = ConfigParam 23;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam23(cell, t) {
  let data = {_:"ConfigParam", number: 23};
  data.limits = loadBlockLimits(cell, t);
  return data;
}

/**
 * Loads MsgForwardPrices  <br>
 * 
 * // msg_fwd_fees = (lump_price + ceil((bit_price * msg.bits + cell_price * msg.cells)/2^16)) nanograms <br>
 * // ihr_fwd_fees = ceil((msg_fwd_fees * ihr_price_factor)/2^16) nanograms <br>
 * // bits in the root cell of a message are not included in msg.bits (lump_price pays for them) <br>
 * msg_forward_prices#ea lump_price:uint64 bit_price:uint64 cell_price:uint64 <br>
 *   ihr_price_factor:uint32 first_frac:uint16 next_frac:uint16 = MsgForwardPrices;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMsgForwardPrices(cell, t) {
  let data = {_:"MsgForwardPrices"};
  if (loadUint8(cell, t) !== 0xea)
    throw Error('not a MsgForwardPrices');
  data.lump_price = loadUint64(cell, t);
  data.bit_price = loadUint64(cell, t);
  data.cell_price = loadUint64(cell, t);
  data.ihr_price_factor = loadUint32(cell, t);
  data.first_frac = loadUint16(cell, t);
  data.next_frac = loadUint16(cell, t);
  return data;
}


/**
 * Loads ConfigParam 24  <br>
 * 
 * // used for messages to/from masterchain <br>
 * config_mc_fwd_prices#_ MsgForwardPrices = ConfigParam 24;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam24(cell, t) {
  let data = {_:"ConfigParam", number: 24};
  data.prices = loadMsgForwardPrices(cell, t);
  return data;
}

/**
 * Loads ConfigParam 25  <br>
 * 
 * // used for all other messages <br>
 * config_fwd_prices#_ MsgForwardPrices = ConfigParam 25;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam25(cell, t) {
  let data = {_:"ConfigParam", number: 25};
  data.prices = loadMsgForwardPrices(cell, t);
  return data;
}

/**
 * Loads CatchainConfig  <br>
 * 
 * catchain_config#c1 mc_catchain_lifetime:uint32 shard_catchain_lifetime:uint32  <br>
 *   shard_validators_lifetime:uint32 shard_validators_num:uint32 = CatchainConfig; <br>
 * 
 * catchain_config_new#c2 flags:(## 7) { flags = 0 } shuffle_mc_validators:Bool <br>
 *   mc_catchain_lifetime:uint32 shard_catchain_lifetime:uint32 <br>
 *   shard_validators_lifetime:uint32 shard_validators_num:uint32 = CatchainConfig; <br>
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCatchainConfig(cell, t) {
  let data = {_:"CatchainConfig"};
  let type = loadUint8(cell, t);
  if (type === 0xc1) {
    data.type = '';
    data.mc_catchain_lifetime = loadUint32(cell, t);
    data.shard_catchain_lifetime = loadUint32(cell, t);
    data.shard_validators_lifetime = loadUint32(cell, t);
    data.shard_validators_num = loadUint32(cell, t);
    return data;
  }
  else if (type === 0xc2) {
    data.type = 'new';
    data.flags = loadUint(cell, t, 7).toNumber();
    if (data.flags !== 0)
      throw Error('data.flags !== 0');
    data.shuffle_mc_validators = loadBool(cell, t);
    data.mc_catchain_lifetime = loadUint32(cell, t);
    data.shard_catchain_lifetime = loadUint32(cell, t);
    data.shard_validators_lifetime = loadUint32(cell, t);
    data.shard_validators_num = loadUint32(cell, t);
    return data;
  }
  throw Error('not a CatchainConfig');
}

/**
 * Loads ConfigParam 28  <br>
 * 
 * _ CatchainConfig = ConfigParam 28;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam28(cell, t) {
  let data = {_:"ConfigParam", number: 28};
  data.catchain = loadCatchainConfig(cell, t);
  return data;
}

/**
 * Loads ConsensusConfig  <br>
 * 
 * consensus_config#d6 round_candidates:# { round_candidates >= 1 } <br>
 *   next_candidate_delay_ms:uint32 consensus_timeout_ms:uint32 <br>
 *   fast_attempts:uint32 attempt_duration:uint32 catchain_max_deps:uint32 <br>
 *   max_block_bytes:uint32 max_collated_bytes:uint32 = ConsensusConfig; <br>
 * 
 * consensus_config_new#d7 flags:(## 7) { flags = 0 } new_catchain_ids:Bool <br>
 *   round_candidates:(## 8) { round_candidates >= 1 } <br>
 *   next_candidate_delay_ms:uint32 consensus_timeout_ms:uint32 <br>
 *   fast_attempts:uint32 attempt_duration:uint32 catchain_max_deps:uint32 <br>
 *   max_block_bytes:uint32 max_collated_bytes:uint32 = ConsensusConfig;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConsensusConfig(cell, t) {
  let data = {_:"ConsensusConfig"};
  let type = loadUint8(cell, t);
  if (type === 0xd6) {
    data.type = '';
    data.round_candidates = loadUint32(cell, t);
    if (data.round_candidates < 1)
      throw Error('data.round_candidates < 1');
    data.next_candidate_delay_ms = loadUint32(cell, t);
    data.consensus_timeout_ms = loadUint32(cell, t);
    data.fast_attempts = loadUint32(cell, t);
    data.attempt_duration = loadUint32(cell, t);
    data.catchain_max_deps = loadUint32(cell, t);
    data.max_block_bytes = loadUint32(cell, t);
    data.max_collated_bytes = loadUint32(cell, t);
    return data;
  }
  else if (type === 0xd7) {
    data.type = 'new';
    data.flags = loadUint(cell, t, 7).toNumber();
    if (data.flags !== 0)
      throw Error('data.flags !== 0');
    data.new_catchain_ids = loadBool(cell, t);
    data.round_candidates = loadUint(cell, t, 8).toNumber();
    if (data.round_candidates < 1)
      throw Error('data.round_candidates < 1');
    data.next_candidate_delay_ms = loadUint32(cell, t);
    data.consensus_timeout_ms = loadUint32(cell, t);
    data.fast_attempts = loadUint32(cell, t);
    data.attempt_duration = loadUint32(cell, t);
    data.catchain_max_deps = loadUint32(cell, t);
    data.max_block_bytes = loadUint32(cell, t);
    data.max_collated_bytes = loadUint32(cell, t);
    return data;
  }
  throw Error('not a ConsensusConfig');
}

/**
 * Loads ConfigParam 29  <br>
 * 
 * _ ConsensusConfig = ConfigParam 29;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam29(cell, t) {
  let data = {_:"ConfigParam", number: 29};
  data.consensus = loadConsensusConfig(cell, t);
  return data;
}

/**
 * Loads ConfigParam 31  <br>
 * 
 * _ fundamental_smc_addr:(HashmapE 256 True) = ConfigParam 31;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam31(cell, t) {
  let data = {_:"ConfigParam", number: 31};
  // eslint-disable-next-line no-unused-vars
  data.fundamental_smc_addr = loadHashmapE(cell, t, 256, (c,p) => true);
  return data;
}

/**
 * Loads SigPubKey  <br>
 * 
 * ed25519_pubkey#8e81278a pubkey:bits256 = SigPubKey;  // 288 bits
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadSigPubKey(cell, t) {
  let data = {_:"SigPubKey"};
  if (loadUint32(cell, t) !== 0x8e81278a)
    throw Error('not a SigPubKey');
  data.pubkey = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ValidatorDescr  <br>
 * 
 * validator#53 public_key:SigPubKey weight:uint64 = ValidatorDescr; <br>
 * validator_addr#73 public_key:SigPubKey weight:uint64 adnl_addr:bits256 = ValidatorDescr;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadValidatorDescr(cell, t) {
  let data = {_:"ValidatorDescr"};
  let type = loadUint8(cell, t);
  if (type === 0x53) {
    data.type = '';
    data.public_key = loadSigPubKey(cell, t);
    data.weight = loadUint64(cell, t);
    return data;
  }
  else if (type === 0x73) {
    data.type = 'addr';
    data.public_key = loadSigPubKey(cell, t);
    data.weight = loadUint64(cell, t);
    data.adnl_addr = loadBits(cell, t, 256);
    return data;
  }
  throw Error('not a ValidatorDescr');
}

/**
 * Loads ValidatorSet  <br>
 * 
 * validators#11 utime_since:uint32 utime_until:uint32  <br>
 *   total:(## 16) main:(## 16) { main <= total } { main >= 1 }  <br>
 *   list:(Hashmap 16 ValidatorDescr) = ValidatorSet; <br>
 * validators_ext#12 utime_since:uint32 utime_until:uint32  <br>
 *   total:(## 16) main:(## 16) { main <= total } { main >= 1 }  <br>
 *   total_weight:uint64 list:(HashmapE 16 ValidatorDescr) = ValidatorSet;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadValidatorSet(cell, t) {
  let data = {_:"ValidatorSet"};
  let type = loadUint8(cell, t);
  if (type === 0x11) {
    data.type = '';
    data.utime_since = loadUint32(cell, t);
    data.utime_until = loadUint32(cell, t);
    data.total = loadUint(cell, t, 16).toNumber();
    data.main = loadUint(cell, t, 16).toNumber();
    if (data.total < data.main)
      throw Error('data.total < data.main');
    if (data.main < 1)
      throw Error('data.main < 1');
    data.list = loadHashmap(cell, t, 16, loadValidatorDescr);
    return data;
  }
  else if (type === 0x12) {
    data.type = 'ext';
    data.utime_since = loadUint32(cell, t);
    data.utime_until = loadUint32(cell, t);
    data.total = loadUint(cell, t, 16).toNumber();
    data.main = loadUint(cell, t, 16).toNumber();
    if (data.total < data.main)
      throw Error('data.total < data.main');
    if (data.main < 1)
      throw Error('data.main < 1');
    data.total_weight = loadUint64(cell, t);
    data.list = loadHashmapE(cell, t, 16, loadValidatorDescr);
    return data;
  }
  throw Error('not a ValidatorSet');
}

/**
 * Loads ConfigParam 32  <br>
 * 
 * _ prev_validators:ValidatorSet = ConfigParam 32;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam32(cell, t) {
  let data = {_:"ConfigParam", number: 32};
  data.prev_validators = loadValidatorSet(cell, t);
  return data;
}

/**
 * Loads ConfigParam 33  <br>
 * 
 * _ prev_temp_validators:ValidatorSet = ConfigParam 33;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam33(cell, t) {
  let data = {_:"ConfigParam", number: 33};
  data.prev_temp_validators = loadValidatorSet(cell, t);
  return data;
}

/**
 * Loads ConfigParam 34  <br>
 * 
 * _ cur_validators:ValidatorSet = ConfigParam 34;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam34(cell, t) {
  let data = {_:"ConfigParam", number: 34};
  data.cur_validators = loadValidatorSet(cell, t);
  return data;
}

/**
 * Loads ConfigParam 35  <br>
 * 
 * _ cur_temp_validators:ValidatorSet = ConfigParam 35;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam35(cell, t) {
  let data = {_:"ConfigParam", number: 35};
  data.cur_temp_validators = loadValidatorSet(cell, t);
  return data;
}

/**
 * Loads ConfigParam 36  <br>
 * 
 * _ next_validators:ValidatorSet = ConfigParam 36;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam36(cell, t) {
  let data = {_:"ConfigParam", number: 36};
  data.next_validators = loadValidatorSet(cell, t);
  return data;
}

/**
 * Loads ConfigParam 37  <br>
 * 
 * _ next_temp_validators:ValidatorSet = ConfigParam 37;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParam37(cell, t) {
  let data = {_:"ConfigParam", number: 37};
  data.next_temp_validators = loadValidatorSet(cell, t);
  return data;
}


/**
 * Loads arbitrary ConfigParam  <br>
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {number} number Param number
 * @returns {Object}
 */
function loadConfigParam(cell, t, number) {
  if (t.cs !== 0 || t.ref !== 0)
    throw Error('Invalid config cell');
  try {
    switch(number) {
      case 0: return loadConfigParam0(cell, t);
      case 1: return loadConfigParam1(cell, t);
      case 2: return loadConfigParam2(cell, t);
      case 3: return loadConfigParam3(cell, t);
      case 4: return loadConfigParam4(cell, t);
      case 6: return loadConfigParam6(cell, t);
      case 7: return loadConfigParam7(cell, t);
      case 8: return loadConfigParam8(cell, t);
      case 9: return loadConfigParam9(cell, t);
      case 10: return loadConfigParam10(cell, t);
      case 11: return loadConfigParam11(cell, t);
      case 12: return loadConfigParam12(cell, t);
      case 13: return loadConfigParam13(cell, t);
      case 14: return loadConfigParam14(cell, t);
      case 15: return loadConfigParam15(cell, t);
      case 16: return loadConfigParam16(cell, t);
      case 17: return loadConfigParam17(cell, t);
      case 18: return loadConfigParam18(cell, t);
      case 20: return loadConfigParam20(cell, t);
      case 21: return loadConfigParam21(cell, t);
      case 22: return loadConfigParam22(cell, t);
      case 23: return loadConfigParam23(cell, t);
      case 24: return loadConfigParam24(cell, t);
      case 25: return loadConfigParam25(cell, t);
      case 28: return loadConfigParam28(cell, t);
      case 29: return loadConfigParam29(cell, t);
      case 31: return loadConfigParam31(cell, t);
      case 32: return loadConfigParam32(cell, t);
      case 33: return loadConfigParam33(cell, t);
      case 34: return loadConfigParam34(cell, t);
      case 35: return loadConfigParam35(cell, t);
      case 36: return loadConfigParam36(cell, t);
      case 37: return loadConfigParam37(cell, t);
      default: return cell;
    }
  } catch (e) {
    console.warn('ConfigParam ' + number + ' parse error:', e);
    return cell;
  }
}


/**
 * Loads ExtraCurrencyCollection  <br>
 * 
 * extra_currencies$_ dict:(HashmapE 32 (VarUInteger 32))  <br>
 *              = ExtraCurrencyCollection;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadExtraCurrencyCollection(cell, t) {
  let data = {_:"ExtraCurrencyCollection"};
  data.dict = loadHashmapE(cell, t, 32, (c,p) => loadVarUInteger(c, p, 32));
  return data;
}

/**
 * Loads CurrencyCollection  <br>
 * 
 * currencies$_ grams:Grams other:ExtraCurrencyCollection  <br>
 *            = CurrencyCollection;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCurrencyCollection(cell, t) {
  let data = {_:"CurrencyCollection"};
  data.grams = loadGrams(cell, t);
  data.other = loadExtraCurrencyCollection(cell, t);
  return data;
}


/**
 * Loads ShardIdent  <br>
 * 
 * shard_ident$00 shard_pfx_bits:(#<= 60)  <br>
 *     workchain_id:int32 shard_prefix:uint64 = ShardIdent;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardIdent(cell, t) {
  if (loadUint(cell, t, 2).toNumber() !== 0)
    throw Error("not a ShardIdent");
  let data = {_:"ShardIdent"};
  data.shard_pfx_bits = loadUintLeq(cell, t, 60);
  data.workchain_id = loadInt32(cell, t);
  data.shard_prefix = loadUint64(cell, t);
  data.shard = new BN(1);
  data.shard = data.shard.shln(63 - data.shard_pfx_bits);
  data.shard = data.shard.or(data.shard_prefix);
  return data;
}

/**
 * Loads BlockIdExt  <br>
 * 
 * block_id_ext$_ shard_id:ShardIdent seq_no:uint32 <br>
 *     root_hash:bits256 file_hash:bits256 = BlockIdExt;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
// eslint-disable-next-line no-unused-vars
function loadBlockIdExt(cell, t) {
  let data = {_:"BlockIdExt"};
  data.shard_id = loadShardIdent(cell, t);
  data.seq_no = loadUint32(cell, t);
  data.root_hash = loadBits(cell, t, 256);
  data.file_hash = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads ExtBlkRef  <br>
 * 
 * ext_blk_ref$_ end_lt:uint64 <br>
 *   seq_no:uint32 root_hash:bits256 file_hash:bits256  <br>
 *   = ExtBlkRef;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadExtBlkRef(cell, t) {
  let data = {_:"ExtBlkRef"};
  data.end_lt = loadUint64(cell, t);
  data.seq_no = loadUint32(cell, t);
  data.root_hash = loadBits(cell, t, 256);
  data.file_hash = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads BlkMasterInfo  <br>
 * 
 * master_info$_ master:ExtBlkRef = BlkMasterInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadBlkMasterInfo(cell, t) {
  let data = {_:"BlkMasterInfo"};
  data.master = loadExtBlkRef(cell, t);
  return data;
}

/**
 * Loads Anycast  <br>
 * 
 * anycast_info$_ depth:(#<= 30) { depth >= 1 } <br>
 *     rewrite_pfx:(bits depth) = Anycast;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAnycast(cell, t) {
  let data = {_:"Anycast"};
  data.depth = loadUintLeq(cell, t, 30);
  if (data.depth < 1)
    throw Error("data.depth < 1");
  data.rewrite_pfx = loadBits(cell, t, data.depth);
}

/**
 * Loads MsgAddressExt  <br>
 * 
 * addr_none$00 = MsgAddressExt; <br>
 * addr_extern$01 len:(## 9) external_address:(bits len)  <br>
 *              = MsgAddressExt;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMsgAddressExt(cell, t) {
  const addr_type = loadUint(cell, t, 2).toNumber();
  let data = {_:"MsgAddressExt"};
  if (addr_type === 0) {
    data.type = "none";
    return data;
  }
  else if (addr_type === 1) {
    data.type = "extern";
    data.len = loadUint(cell, t, 9);
    data.external_address = loadBits(cell, t, data.len);
    return data;
  }
  throw Error("not a MsgAddressExt");
}

/**
 * Loads MsgAddressInt  <br>
 * 
 * addr_std$10 anycast:(Maybe Anycast)  <br>
 *    workchain_id:int8 address:bits256  = MsgAddressInt; <br>
 * addr_var$11 anycast:(Maybe Anycast) addr_len:(## 9)  <br>
 *    workchain_id:int32 address:(bits addr_len) = MsgAddressInt;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMsgAddressInt(cell, t) {
  const addr_type = loadUint(cell, t, 2).toNumber();
  let data = {_:"MsgAddressInt"};
  if (addr_type === 2) {
    data.type = "std";
    data.anycast = loadMaybe(cell, t, loadAnycast);
    data.workchain_id = loadInt8(cell, t);
    data.address = loadBits(cell, t, 256);
    return data;
  }
  else if (addr_type === 3) {
    data.type = "var";
    data.anycast = loadMaybe(cell, t, loadAnycast);
    data.addr_len = loadUint(cell, t, 9).toNumber();
    data.workchain_id = loadInt32(cell, t);
    data.address = loadBits(cell, t, data.addr_len);
    return data;
  }
  throw Error("not a MsgAddressInt");
}

/**
 * Loads StorageUsed  <br>
 * 
 * storage_used$_ cells:(VarUInteger 7) bits:(VarUInteger 7)  <br>
 *     public_cells:(VarUInteger 7) = StorageUsed;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadStorageUsed(cell, t) {
  let data = {_:"StorageUsed"};
  data.cells = loadVarUInteger(cell, t, 7);
  data.bits = loadVarUInteger(cell, t, 7);
  data.public_cells = loadVarUInteger(cell, t, 7);
  return data;
}

/**
 * Loads StorageInfo  <br>
 * 
 * storage_info$_ used:StorageUsed last_paid:uint32 <br>
 *           due_payment:(Maybe Grams) = StorageInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadStorageInfo(cell, t) {
  let data = {_:"StorageInfo"};
  data.used = loadStorageUsed(cell, t);
  data.last_paid = loadUint32(cell, t);
  data.due_payment = loadMaybe(cell, t, loadGrams);
  return data;
}

/**
 * Loads TickTock  <br>
 * 
 * tick_tock$_ tick:Bool tock:Bool = TickTock;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTickTock(cell, t) {
  let data = {_:"TickTock"};
  data.tick = loadBool(cell, t);
  data.tock = loadBool(cell, t);
  return data;
}

/**
 * Loads StateInit  <br>
 * 
 * _ split_depth:(Maybe (## 5)) special:(Maybe TickTock) <br>
 *     code:(Maybe ^Cell) data:(Maybe ^Cell) <br>
 *     library:(HashmapE 256 SimpleLib) = StateInit;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadStateInit(cell, t) {
  let data = {_:"StateInit"};
  data.split_depth = loadMaybe(cell, t, loadUint, [5]);
  data.special = loadMaybe(cell, t, loadTickTock);
  // eslint-disable-next-line no-unused-vars
  data.code = loadMaybeRef(cell, t, (c, p) => c);
  // eslint-disable-next-line no-unused-vars
  data.data = loadMaybeRef(cell, t, (c, p) => c);
  // eslint-disable-next-line no-unused-vars
  data.library = loadMaybe(cell, t, (c, p) => loadHashmapE(c, p, 256, (c2, p2) => c2)); // TODO SimpleLib
  return data;
}

/**
 * Loads AccountState  <br>
 * 
 * account_uninit$00 = AccountState; <br>
 * account_active$1 _:StateInit = AccountState; <br>
 * account_frozen$01 state_hash:bits256 = AccountState;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAccountState(cell, t) {
  let data = {_:"AccountState"};
  const active = loadBit(cell, t);
  if (active) {
    data.state = 'active';
    data = Object.assign(data, loadStateInit(cell, t));
  }
  else {
    const frozen = loadBit(cell, t);
    if (frozen) {
      data.state = 'frozen';
      data.state_hash = loadBits(cell, t, 256);
    }
    else {
      data.state = 'uninit';
    }
  }
  return data;
}

/**
 * Loads AccountStorage  <br>
 * 
 * account_storage$_ last_trans_lt:uint64 <br>
 *     balance:CurrencyCollection state:AccountState  <br>
 *   = AccountStorage;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAccountStorage(cell, t) {
  let data = {_:"AccountState"};
  data.last_trans_lt = loadUint64(cell, t);
  data.balance = loadCurrencyCollection(cell, t);
  data.state = loadAccountState(cell, t);
  return data;
}

/**
 * Loads Account  <br>
 * 
 * account_none$0 = Account; <br>
 * account$1 addr:MsgAddressInt storage_stat:StorageInfo <br>
 *       storage:AccountStorage = Account;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAccount(cell, t) {
  if (cell.type === Cell.PrunnedBranchCell)
    return cell;
  let data = {_:"Account", cell, hash: cell.getHash(0)};
  const exist = loadBit(cell, t);
  if (!exist) {
    data.type = 'none';
    return data;
  }
  data.type = '';
  data.addr = loadMsgAddressInt(cell, t);
  data.storage_stat = loadStorageInfo(cell, t);
  data.storage = loadAccountStorage(cell, t);
  return data;
}

/**
 * Loads ShardAccount  <br>
 * 
 * account_descr$_ account:^Account last_trans_hash:bits256  <br>
 *   last_trans_lt:uint64 = ShardAccount;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardAccount(cell, t) {
  let data = {_:"ShardAccount"};
  data.account = loadAccount(cell.refs[t.ref++], {cs:0, ref:0});
  data.last_trans_hash = loadBits(cell, t, 256);
  data.last_trans_lt = loadUint64(cell, t);
  return data;
}

/**
 * Loads DepthBalanceInfo  <br>
 * 
 * depth_balance$_ split_depth:(#<= 30) balance:CurrencyCollection = DepthBalanceInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadDepthBalanceInfo(cell, t) {
  let data = {_:"DepthBalanceInfo"};
  data.split_depth = loadUintLeq(cell, t, 30);
  data.balance = loadCurrencyCollection(cell, t);
  return data;
}

/**
 * Loads ShardAccounts  <br>
 * 
 * _ (HashmapAugE 256 ShardAccount DepthBalanceInfo) = ShardAccounts;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardAccounts(cell, t) {
  return loadHashmapAugE(cell, t, 256, loadShardAccount, loadDepthBalanceInfo);
}

/**
 * Loads HASH_UPDATE  <br>
 * 
 * update_hashes#72 {X:Type} old_hash:bits256 new_hash:bits256 <br>
 *     = HASH_UPDATE X;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadHASH_UPDATE(cell, t) {
  if (loadUint8(cell, t) !== 0x72) {
    throw Error("not a HASH_UPDATE");
  }
  let data = {_:"HASH_UPDATE"};
  data.old_hash = loadBits(cell, t, 256);
  data.new_hash = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads AccStatusChange  <br>
 * 
 * acst_unchanged$0 = AccStatusChange;  // x -> x <br>
 * acst_frozen$10 = AccStatusChange;    // init -> frozen <br>
 * acst_deleted$11 = AccStatusChange;   // frozen -> deleted
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAccStatusChange(cell, t) {
  const unchanged = loadBit(cell, t);
  if (unchanged === 0) {
    return "unchanged";
  }
  const acst = loadBit(cell, t);
  if (acst === 0) {
    return "frozen";
  } else {
    return "deleted";
  }
}

/**
 * Loads TrStoragePhase  <br>
 * 
 * tr_phase_storage$_ storage_fees_collected:Grams  <br>
 *   storage_fees_due:(Maybe Grams) <br>
 *   status_change:AccStatusChange <br>
 *   = TrStoragePhase;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTrStoragePhase(cell, t) {
  let data = {_:"TrStoragePhase"};
  data.storage_fees_collected = loadGrams(cell, t);
  data.storage_fees_due = loadMaybe(cell, t, loadGrams);
  data.status_change = loadAccStatusChange(cell, t);
  return data;
}

/**
 * Loads TrCreditPhase  <br>
 * 
 * tr_phase_credit$_ due_fees_collected:(Maybe Grams) <br>
 *   credit:CurrencyCollection = TrCreditPhase;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTrCreditPhase(cell, t) {
  let data = {_:"TrCreditPhase"};
  data.due_fees_collected = loadMaybe(cell, t, loadGrams);
  data.credit = loadCurrencyCollection(cell, t);
  return data;
}

/**
 * Loads StorageUsedShort  <br>
 * 
 * storage_used_short$_ cells:(VarUInteger 7)  <br>
 *   bits:(VarUInteger 7) = StorageUsedShort;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadStorageUsedShort(cell, t) {
  let data = {_:"StorageUsedShort"};
  data.cells = loadVarUInteger(cell, t, 7);
  data.bits = loadVarUInteger(cell, t, 7);
  return data;
}

/**
 * Loads TrActionPhase  <br>
 * 
 * tr_phase_action$_ success:Bool valid:Bool no_funds:Bool <br>
 *   status_change:AccStatusChange <br>
 *   total_fwd_fees:(Maybe Grams) total_action_fees:(Maybe Grams) <br>
 *   result_code:int32 result_arg:(Maybe int32) tot_actions:uint16 <br>
 *   spec_actions:uint16 skipped_actions:uint16 msgs_created:uint16  <br>
 *   action_list_hash:bits256 tot_msg_size:StorageUsedShort  <br>
 *   = TrActionPhase;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTrActionPhase(cell, t) {
  let data = {_:"TrActionPhase"};
  data.success = loadBool(cell, t);
  data.valid = loadBool(cell, t);
  data.no_funds = loadBool(cell, t);
  data.status_change = loadAccStatusChange(cell, t);
  data.total_fwd_fees = loadMaybe(cell, t, loadGrams);
  data.total_action_fees = loadMaybe(cell, t, loadGrams);
  data.result_code = loadInt32(cell, t);
  data.result_arg = loadMaybe(cell, t, loadInt32);
  data.tot_actions = loadUint16(cell, t);
  data.spec_actions = loadUint16(cell, t);
  data.skipped_actions = loadUint16(cell, t);
  data.msgs_created = loadUint16(cell, t);
  data.action_list_hash = loadBits(cell, t, 256);
  data.tot_msg_size = loadStorageUsedShort(cell, t);
  return data;
}

/**
 * Loads TrBouncePhase  <br>
 * 
 * tr_phase_bounce_negfunds$00 = TrBouncePhase; <br>
 * tr_phase_bounce_nofunds$01 msg_size:StorageUsedShort <br>
 *   req_fwd_fees:Grams = TrBouncePhase; <br>
 * tr_phase_bounce_ok$1 msg_size:StorageUsedShort  <br>
 *   msg_fees:Grams fwd_fees:Grams = TrBouncePhase;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTrBouncePhase(cell, t) {
  const type = loadBit(cell, t);
  let data = {_:"TrBouncePhase"};
  if (type === 1) {
    // tr_phase_bounce_ok
    data.type = "ok";
    data.msg_size = loadStorageUsedShort(cell, t);
    data.msg_fees = loadGrams(cell ,t);
    data.fwd_fees = loadGrams(cell ,t);
    return data;
  }
  else {
    const type2 = loadBit(cell, t);
    if (type2 === 0) {
      // tr_phase_bounce_negfunds
      data.type = "negfunds";
      return data;
    }
    else {
      // tr_phase_bounce_nofunds
      data.type = "nofunds";
      data.msg_size = loadStorageUsedShort(cell, t);
      data.req_fwd_fees = loadGrams(cell ,t);
      return data;
    }
  }
}

/**
 * Loads ComputeSkipReason  <br>
 * 
 * cskip_no_state$00 = ComputeSkipReason; <br>
 * cskip_bad_state$01 = ComputeSkipReason; <br>
 * cskip_no_gas$10 = ComputeSkipReason;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadComputeSkipReason(cell, t) {
  const type = loadUint(cell, t, 2).toNumber();
  if (type === 0) {
    return "no_state";
  }
  else if (type === 1) {
    return "bad_state";
  }
  else if (type === 2) {
    return "no_gas";
  }
  throw Error("not a ComputeSkipReason");
}

/**
 * Loads TrComputePhase  <br>
 * 
 * tr_phase_compute_skipped$0 reason:ComputeSkipReason <br>
 *   = TrComputePhase; <br>
 * tr_phase_compute_vm$1 success:Bool msg_state_used:Bool  <br>
 *   account_activated:Bool gas_fees:Grams <br>
 *   ^[ gas_used:(VarUInteger 7) <br>
 *   gas_limit:(VarUInteger 7) gas_credit:(Maybe (VarUInteger 3)) <br>
 *   mode:int8 exit_code:int32 exit_arg:(Maybe int32) <br>
 *   vm_steps:uint32 <br>
 *   vm_init_state_hash:bits256 vm_final_state_hash:bits256 ] <br>
 *   = TrComputePhase;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTrComputePhase(cell, t) {
  const type = loadBit(cell, t);
  let data = {_:"TrComputePhase"};
  if (type === 0) {
    // tr_phase_compute_skipped
    data.type = "skipped";
    data.reason = loadComputeSkipReason(cell, t);
    return data;
  }
  else {
    // tr_phase_compute_vm
    data.type = "vm";
    data.success = loadBool(cell, t);
    data.msg_state_used = loadBool(cell, t);
    data.account_activated = loadBool(cell, t);
    data.gas_fees = loadGrams(cell, t);

    let cell_r1 = cell.refs[t.ref++];
    let tr1 = {cs: 0, ref: 0};
    if (cell_r1.type === Cell.OrdinaryCell) {
      data.gas_used = loadVarUInteger(cell_r1, tr1, 7);
      data.gas_limit = loadVarUInteger(cell_r1, tr1, 7);
      data.gas_credit = loadMaybe(cell_r1, tr1, loadVarUInteger, [3]);
      data.mode = loadInt8(cell_r1, tr1);
      data.exit_code = loadInt32(cell_r1, tr1);
      data.exit_arg = loadMaybe(cell_r1, tr1, loadInt32);
      data.vm_steps = loadUint32(cell_r1, tr1);
      data.vm_init_state_hash = loadBits(cell_r1, tr1, 256);
      data.vm_final_state_hash = loadBits(cell_r1, tr1, 256);
    }
    return data;
  }
}

/**
 * Loads TransactionDescr  <br>
 * 
 * trans_ord$0000 credit_first:Bool <br>
 *   storage_ph:(Maybe TrStoragePhase) <br>
 *   credit_ph:(Maybe TrCreditPhase) <br>
 *   compute_ph:TrComputePhase action:(Maybe ^TrActionPhase) <br>
 *   aborted:Bool bounce:(Maybe TrBouncePhase) <br>
 *   destroyed:Bool <br>
 *   = TransactionDescr; <br>
 * 
 * trans_storage$0001 storage_ph:TrStoragePhase <br>
 *   = TransactionDescr; <br>
 * 
 * trans_tick_tock$001 is_tock:Bool storage_ph:TrStoragePhase <br>
 *   compute_ph:TrComputePhase action:(Maybe ^TrActionPhase) <br>
 *   aborted:Bool destroyed:Bool = TransactionDescr;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTransactionDescr(cell, t) {
  const type = loadUint(cell, t, 3).toNumber();
  let data = {_:"TransactionDescr"};
  if (type === 0) {
    const type2 = loadBit(cell, t);
    if (type2 === 0) {
      // trans_ord
      data.type = "ord";
      data.credit_first = loadBool(cell, t);
      data.storage_ph = loadMaybe(cell, t, loadTrStoragePhase);
      data.credit_ph = loadMaybe(cell, t, loadTrCreditPhase);
      data.compute_ph = loadTrComputePhase(cell, t);
      data.action = loadMaybeRef(cell, t, loadTrActionPhase);
      data.aborted = loadBool(cell, t);
      data.bounce = loadMaybe(cell, t, loadTrBouncePhase);
      data.destroyed = loadBool(cell, t);
      return data;
    }
    else {
      // trans_storage
      data.type = "storage";
      data.storage_ph = loadTrStoragePhase(cell, t);
      return data;
    }
  }
  else if (type === 1) {
    //trans_tick_tock
    data.type = "tick_tock";
    data.is_tock = loadBool(cell, t);
    data.storage_ph = loadTrStoragePhase(cell, t);
    data.compute_ph = loadTrComputePhase(cell, t);
    data.action = loadMaybeRef(cell, t, loadTrActionPhase);
    data.aborted = loadBool(cell, t);
    data.destroyed = loadBool(cell, t);
    return data;
  }
  throw Error("not a TransactionDescr");
}

/**
 * Loads AccountStatus  <br>
 * 
 * acc_state_uninit$00 = AccountStatus; <br>
 * acc_state_frozen$01 = AccountStatus; <br>
 * acc_state_active$10 = AccountStatus; <br>
 * acc_state_nonexist$11 = AccountStatus;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAccountStatus(cell, t) {
  const type = loadUint(cell, t, 2).toNumber();
  switch(type) {
    case 0: return "uninit";
    case 1: return "frozen";
    case 2: return "active";
    case 3: return "nonexist";
  }
}

/**
 * Loads CommonMsgInfo  <br>
 * 
 * int_msg_info$0 ihr_disabled:Bool bounce:Bool bounced:Bool <br>
 *   src:MsgAddressInt dest:MsgAddressInt  <br>
 *   value:CurrencyCollection ihr_fee:Grams fwd_fee:Grams <br>
 *   created_lt:uint64 created_at:uint32 = CommonMsgInfo; <br>
 * ext_in_msg_info$10 src:MsgAddressExt dest:MsgAddressInt  <br>
 *   import_fee:Grams = CommonMsgInfo; <br>
 * ext_out_msg_info$11 src:MsgAddressInt dest:MsgAddressExt <br>
 *   created_lt:uint64 created_at:uint32 = CommonMsgInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCommonMsgInfo(cell, t) {
  let data = {_:"CommonMsgInfo"};
  let b = loadBit(cell, t);
  if (b === 0) {
    data.type = 'int';
    data.ihr_disabled = loadBool(cell, t);
    data.bounce = loadBool(cell, t);
    data.bounced = loadBool(cell, t);
    data.src = loadMsgAddressInt(cell, t);
    data.dest = loadMsgAddressInt(cell, t);
    data.value = loadCurrencyCollection(cell, t);
    data.ihr_fee = loadGrams(cell, t);
    data.fwd_fee = loadGrams(cell, t);
    data.created_lt = loadUint64(cell, t);
    data.created_at = loadUint32(cell, t);
    return data;
  }
  else {
    b = loadBit(cell, t);
    if (b === 0) {
      data.type = 'ext_in';
      data.src = loadMsgAddressExt(cell, t);
      data.dest = loadMsgAddressInt(cell, t);
      data.import_fee = loadGrams(cell, t);
      return data;
    }
    else {
      data.type = 'ext_out';
      data.src = loadMsgAddressInt(cell, t);
      data.dest = loadMsgAddressExt(cell, t);
      data.created_lt = loadUint64(cell, t);
      data.created_at = loadUint32(cell, t);
      return data;
    }
  }
}

/**
 * Loads any type  <br>
 * 
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAny(cell, t) {
  let data = {_:"Any"};
  data.cell = cell;
  data.current_pos = t.cs;
  data.current_ref = t.ref;
  return data;
}

/**
 * Loads Message  <br>
 * 
 * message$_ {X:Type} info:CommonMsgInfo <br>
 *   init:(Maybe (Either StateInit ^StateInit)) <br>
 *   body:(Either X ^X) = Message X;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMessage(cell, t) {
  let data = {_:"Message", cell, hash: cell.getHash(0)};
  data.info = loadCommonMsgInfo(cell, t);
  data.init = loadMaybe(cell, t,
      (c,p) => loadEither(c,p,
          (c2,p2) => loadStateInit(c2, p2), (c3,p3) => loadRefIfExist(c3, p3, (c4,p4) => loadStateInit(c4, p4))));
  data.body = loadEither(cell, t,
      (c,p) => loadAny(c,p), (c2,p2) => loadRefIfExist(c2,p2, (c3,p3) => loadAny(c3,p3)));
  return data;
}

/**
 * Loads Transaction  <br>
 * 
 * transaction$0111 account_addr:bits256 lt:uint64  <br>
 *   prev_trans_hash:bits256 prev_trans_lt:uint64 now:uint32 <br>
 *   outmsg_cnt:uint15 <br>
 *   orig_status:AccountStatus end_status:AccountStatus <br>
 *   ^[ in_msg:(Maybe ^(Message Any)) out_msgs:(HashmapE 15 ^(Message Any)) ] <br>
 *   total_fees:CurrencyCollection state_update:^(HASH_UPDATE Account) <br>
 *   description:^TransactionDescr = Transaction;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadTransaction(cell, t) {
  if (loadUint(cell, t, 4).toNumber() !== 7) {
    throw Error("not a Transaction");
  }
  let data = {_:"Transaction", cell, hash: cell.getHash(0)};
  data.account_addr = loadBits(cell, t, 256);
  data.lt = loadUint64(cell, t);
  data.prev_trans_hash = loadBits(cell, t, 256);
  data.prev_trans_lt = loadUint64(cell, t);
  data.now = loadUint32(cell, t);
  data.outmsg_cnt = loadUint(cell, t, 15).toNumber();
  data.orig_status = loadAccountStatus(cell, t);
  data.end_status = loadAccountStatus(cell, t);

  let cell_r1 = cell.refs[t.ref++];
  let tr1 = {cs: 0, ref: 0};
  if (cell_r1.type === Cell.OrdinaryCell) {
    data.in_msg = loadMaybeRef(cell_r1, tr1, loadMessage);
    data.out_msgs = loadHashmapE(cell_r1, tr1, 15, (c,p) => loadRefIfExist(c, p, loadMessage));
  }

  data.total_fees = loadCurrencyCollection(cell, t);
  data.state_update = loadRefIfExist(cell, t, loadHASH_UPDATE);
  data.description = loadRefIfExist(cell, t, loadTransactionDescr);
  return data;
}


/**
 * Loads AccountBlock  <br>
 * 
 * acc_trans#5 account_addr:bits256 <br>
 *         transactions:(HashmapAug 64 ^Transaction CurrencyCollection) <br>
 *         state_update:^(HASH_UPDATE Account) <br>
 *       = AccountBlock;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadAccountBlock(cell, t) {
  if (loadUint(cell, t, 4).toNumber() !== 0x5) {
    throw Error("not an AccountBlock");
  }
  let data = {_:"AccountBlock"};
  data.account_addr = loadBits(cell, t, 256);
  data.transactions = loadHashmapAug(cell, t, 64, (c, p) => loadRefIfExist(c, p, loadTransaction), loadCurrencyCollection);
  data.state_update = loadRefIfExist(cell, t, loadHASH_UPDATE);
  return data;
}

/**
 * Loads ShardAccountBlocks  <br>
 * 
 * _ (HashmapAugE 256 AccountBlock CurrencyCollection) = ShardAccountBlocks;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardAccountBlocks(cell, t) {
  return loadHashmapAugE(cell, t, 256, loadAccountBlock, loadCurrencyCollection);
}

/**
 * Loads ConfigParams  <br>
 * 
 * _ config_addr:bits256 config:^(Hashmap 32 ^Cell)  <br>
 *   = ConfigParams;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadConfigParams(cell, t) {
  let data = {_:"ConfigParams"};
  data.config_addr = loadBits(cell, t, 256);
  data.config = loadRefIfExist(cell, t, 
    (c, p) => loadHashmap(c, p, 32, 
      (c2, p2, n) => loadRefIfExist(c2, p2, 
          (c3, p3) => loadConfigParam(c3, p3, n.toNumber()))));
  return data;
}

/**
 * Loads ValidatorInfo  <br>
 * 
 * validator_info$_ <br>
 *   validator_list_hash_short:uint32  <br>
 *   catchain_seqno:uint32 <br>
 *   nx_cc_updated:Bool <br>
 * = ValidatorInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadValidatorInfo(cell, t) {
  let data = {_:"ValidatorInfo"};
  data.validator_list_hash_short = loadUint32(cell, t);
  data.catchain_seqno = loadUint32(cell, t);
  data.nx_cc_updated = loadBool(cell, t);
  return data;
}

/**
 * Loads KeyExtBlkRef  <br>
 * 
 * _ key:Bool blk_ref:ExtBlkRef = KeyExtBlkRef;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadKeyExtBlkRef(cell, t) {
  let data = {_:"KeyExtBlkRef"};
  data.key = loadBool(cell, t);
  data.blk_ref = loadExtBlkRef(cell, t);
  return data;
}

/**
 * Loads KeyMaxLt  <br>
 * 
 * _ key:Bool max_end_lt:uint64 = KeyMaxLt;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadKeyMaxLt(cell, t) {
  let data = {_:"KeyExtKeyMaxLtBlkRef"};
  data.key = loadBool(cell, t);
  data.max_end_lt = loadUint64(cell, t);
  return data;
}

/**
 * Loads OldMcBlocksInfo  <br>
 * 
 * _ (HashmapAugE 32 KeyExtBlkRef KeyMaxLt) = OldMcBlocksInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadOldMcBlocksInfo(cell, t) {
  return loadHashmapAugE(cell, t, 32, loadKeyExtBlkRef, loadKeyMaxLt);
}

/**
 * Loads Counters  <br>
 * 
 * counters#_ last_updated:uint32 total:uint64 cnt2048:uint64 cnt65536:uint64 = Counters; 
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCounters(cell, t) {
  let data = {_:"Counters"};
  data.last_updated = loadUint32(cell, t);
  data.total = loadUint64(cell, t);
  data.cnt2048 = loadUint64(cell, t);
  data.cnt65536 = loadUint64(cell, t);
  return data;
}

/**
 * Loads CreatorStats  <br>
 * 
 * creator_info#4 mc_blocks:Counters shard_blocks:Counters = CreatorStats; 
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCreatorStats(cell, t) {
  if (loadUint(cell, t, 4).toNumber() !== 0x4) {
    throw Error("not an CreatorStats");
  }
  let data = {_:"CreatorStats"};
  data.mc_blocks = loadCounters(cell, t);
  data.shard_blocks = loadCounters(cell, t);
  return data;
}

/**
 * Loads BlockCreateStats  <br>
 * 
 * block_create_stats#17 counters:(HashmapE 256 CreatorStats) = BlockCreateStats; <br>
 * block_create_stats_ext#34 counters:(HashmapAugE 256 CreatorStats uint32) = BlockCreateStats;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadBlockCreateStats(cell, t) {
  let data = {_:"BlockCreateStats"};
  let type = loadUint8(cell, t);
  if (type === 0x17) {
    data.type = '';
    data.counters = loadHashmapE(cell, t, 256, loadCreatorStats);
  }
  else if (type === 0x34) {
    data.type = 'ext';
    data.counters = loadHashmapAugE(cell, t, 256, loadCreatorStats, loadUint32);
  }
  return data;
}

/**
 * Loads McStateExtra  <br>
 * 
 * masterchain_state_extra#cc26 <br>
 *   shard_hashes:ShardHashes <br>
 *   config:ConfigParams <br>
 *   ^[ flags:(## 16) { flags <= 1 } <br>
 *      validator_info:ValidatorInfo <br>
 *      prev_blocks:OldMcBlocksInfo <br>
 *      after_key_block:Bool <br>
 *      last_key_block:(Maybe ExtBlkRef) <br>
 *      block_create_stats:(flags . 0)?BlockCreateStats ] <br>
 *   global_balance:CurrencyCollection <br>
 * = McStateExtra;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMcStateExtra(cell, t) {
  if (loadUint16(cell, t) !== 0xcc26) {
    throw Error("not a McStateExtra");
  }
  let data = {_:"McStateExtra"};
  data.shard_hashes = loadShardHashes(cell, t);
  data.config = loadConfigParams(cell, t);

  let cell_r1 = cell.refs[t.ref++];
  let tr1 = {cs: 0, ref: 0};
  if (cell_r1.type === Cell.OrdinaryCell) {
    data.flags = loadUint16(cell_r1, tr1);
    if (data.flags > 1)
      throw Error("data.flags > 1");
    data.validator_info = loadValidatorInfo(cell_r1, tr1);
    data.prev_blocks = loadOldMcBlocksInfo(cell_r1, tr1);
    data.after_key_block = loadBool(cell_r1, tr1);
    data.last_key_block = loadMaybe(cell_r1, tr1, loadExtBlkRef);
    if (data.flags & 1)
      data.block_create_stats = loadBlockCreateStats(cell_r1, tr1);
  }

  data.global_balance = loadCurrencyCollection(cell, t);
  return data;
}


/**
 * Loads ShardStateUnsplit  <br>
 * 
 * shard_state#9023afe2 global_id:int32 <br>
 *   shard_id:ShardIdent  <br>
 *   seq_no:uint32 vert_seq_no:# <br>
 *   gen_utime:uint32 gen_lt:uint64 <br>
 *   min_ref_mc_seqno:uint32 <br>
 *   out_msg_queue_info:^OutMsgQueueInfo <br>
 *   before_split:(## 1) <br>
 *   accounts:^ShardAccounts <br>
 *   ^[ overload_history:uint64 underload_history:uint64 <br>
 *   total_balance:CurrencyCollection <br>
 *   total_validator_fees:CurrencyCollection <br>
 *   libraries:(HashmapE 256 LibDescr) <br>
 *   master_ref:(Maybe BlkMasterInfo) ] <br>
 *   custom:(Maybe ^McStateExtra) <br>
 *   = ShardStateUnsplit;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardStateUnsplit(cell) {
  let t = {cs: 0, ref: 0};
  if (loadUint32(cell, t) !== 0x9023afe2)
    throw Error("not a ShardStateUnsplit");
  let data = {_:"ShardStateUnsplit"};

  data.global_id = loadInt32(cell, t);
  data.shard_id = loadShardIdent(cell, t);
  data.seq_no = loadUint32(cell, t);
  data.vert_seq_no = loadUint32(cell, t);
  data.gen_utime = loadUint32(cell, t);
  data.gen_lt = loadUint64(cell, t);
  data.min_ref_mc_seqno = loadUint32(cell, t);
  data.out_msg_queue_info = cell.refs[t.ref++];
  data.before_split = loadBit(cell, t);
  data.accounts = loadShardAccounts(cell.refs[t.ref++], {cs:0, ref:0});

  let cell_r1 = cell.refs[t.ref++];
  let tr1 = {cs: 0, ref: 0};
  if (cell_r1.type === Cell.OrdinaryCell) {
    data.overload_history = loadUint64(cell_r1, tr1.cs);
    data.underload_history = loadUint64(cell_r1, tr1.cs);
    data.total_balance = loadCurrencyCollection(cell_r1, tr1);
    data.total_validator_fees = loadCurrencyCollection(cell_r1, tr1);
    // eslint-disable-next-line no-unused-vars
    data.libraries = loadHashmapE(cell_r1, tr1, 256, (c,p) => c);
    data.master_ref = loadMaybe(cell_r1, tr1, loadBlkMasterInfo);
  }

  data.custom = loadMaybeRef(cell, t, loadMcStateExtra);
  return data;
}


/**
 * Loads GlobalVersion  <br>
 * 
 * capabilities#c4 version:uint32 capabilities:uint64 = GlobalVersion;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadGlobalVersion(cell, t) {
  if (loadUint8(cell, t) !== 0xc4)
    throw Error("not a GlobalVersion");
  let data = {_:"GlobalVersion"};
  data.version = loadUint32(cell, t);
  data.capabilities = loadUint64(cell, t);
  return data;
}

/**
 * Loads BlkPrevInfo  <br>
 * 
 * prev_blk_info$_ prev:ExtBlkRef = BlkPrevInfo 0; <br>
 * prev_blks_info$_ prev1:^ExtBlkRef prev2:^ExtBlkRef = BlkPrevInfo 1;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadBlkPrevInfo(cell, t, n) {
  let data = {_:"BlkPrevInfo"};
  if (n === 0) {
    data.type = "prev_blk_info";
    data.prev = loadExtBlkRef(cell, t);
  } else {
    data.type = "prev_blks_info";
    data.prev1 = loadRefIfExist(cell, t, loadExtBlkRef);
    data.prev2 = loadRefIfExist(cell, t, loadExtBlkRef);
  }
  return data;
}

/**
 * Loads BlockInfo  <br>
 * 
 * block_info#9bc7a987 version:uint32  <br>
 *   not_master:(## 1)  <br>
 *   after_merge:(## 1) before_split:(## 1)  <br>
 *   after_split:(## 1)  <br>
 *   want_split:Bool want_merge:Bool <br>
 *   key_block:Bool vert_seqno_incr:(## 1) <br>
 *   flags:(## 8) { flags <= 1 } <br>
 *   seq_no:# vert_seq_no:# { vert_seq_no >= vert_seqno_incr }  <br>
 *   { prev_seq_no:# } { ~prev_seq_no + 1 = seq_no }  <br>
 *   shard:ShardIdent gen_utime:uint32 <br>
 *   start_lt:uint64 end_lt:uint64 <br>
 *   gen_validator_list_hash_short:uint32 <br>
 *   gen_catchain_seqno:uint32 <br>
 *   min_ref_mc_seqno:uint32 <br>
 *   prev_key_block_seqno:uint32 <br>
 *   gen_software:flags . 0?GlobalVersion <br>
 *   master_ref:not_master?^BlkMasterInfo  <br>
 *   prev_ref:^(BlkPrevInfo after_merge) <br>
 *   prev_vert_ref:vert_seqno_incr?^(BlkPrevInfo 0) <br>
 *   = BlockInfo;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @returns {Object}
 */
function loadBlockInfo(cell) {
  let t = {cs: 0, ref: 0};
  if (loadUint32(cell, t) !== 0x9bc7a987)
    throw Error("not a BlockInfo");
  let data = {_:"BlockInfo"};
  data.version = loadUint32(cell, t);
  data.not_master = loadBit(cell, t);
  data.after_merge = loadBit(cell, t);
  data.before_split = loadBit(cell, t);
  data.after_split = loadBit(cell, t);
  data.want_split = loadBool(cell, t);
  data.want_merge = loadBool(cell, t);
  data.key_block = loadBool(cell, t);
  data.vert_seqno_incr = loadBit(cell, t);
  data.flags = loadUint8(cell, t);
  if (data.flags > 1)
    throw Error("data.flags > 1");

  data.seq_no = loadUint32(cell, t);
  data.vert_seq_no = loadUint32(cell, t);
  if (data.vert_seqno_incr > data.vert_seq_no)
    throw Error("data.vert_seqno_incr > data.vert_seq_no");

  data.prev_seq_no = data.seq_no - 1;

  data.shard = loadShardIdent(cell, t);

  data.gen_utime = loadUint32(cell, t);
  data.start_lt = loadUint64(cell, t);
  data.end_lt = loadUint64(cell, t);
  data.gen_validator_list_hash_short = loadUint32(cell, t);
  data.gen_catchain_seqno = loadUint32(cell, t);
  data.min_ref_mc_seqno = loadUint32(cell, t);
  data.prev_key_block_seqno = loadUint32(cell, t);
  if (data.flags & 1) {
    data.gen_software = loadGlobalVersion(cell, t);
  }
  if (data.not_master) {
    data.master_ref  = loadRefIfExist(cell, t, loadBlkMasterInfo);
  }
  data.prev_ref = loadRefIfExist(cell, t, (c,p) => loadBlkPrevInfo(c, p, data.after_merge));
  if (data.vert_seqno_incr) {
    data.prev_vert_ref = loadRefIfExist(cell, t, (c,p) => loadBlkPrevInfo(c, p, 0));
  }
  return data;
}


/**
 * Loads FutureSplitMerge  <br>
 * 
 * fsm_none$0 = FutureSplitMerge; <br>
 * fsm_split$10 split_utime:uint32 interval:uint32 = FutureSplitMerge; <br>
 * fsm_merge$11 merge_utime:uint32 interval:uint32 = FutureSplitMerge;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadFutureSplitMerge(cell, t) {
  const type = loadBit(cell, t);
  let data = {_:"FutureSplitMerge"};
  if (type === 0) {
    data.type = "none";
  }
  else {
    const type2 = loadBit(cell, t);
    if (type2 === 0) {
      data.type = "split";
      data.split_utime = loadUint32(cell, t);
      data.interval = loadUint32(cell, t);
    }
    else {
      data.type = "merge";
      data.merge_utime = loadUint32(cell, t);
      data.interval = loadUint32(cell, t);
    }
  }
  return data;
}

/**
 * Loads ShardDescr  <br>
 * 
 * shard_descr#b seq_no:uint32 reg_mc_seqno:uint32 <br>
 *   start_lt:uint64 end_lt:uint64 <br>
 *   root_hash:bits256 file_hash:bits256  <br>
 *   before_split:Bool before_merge:Bool <br>
 *   want_split:Bool want_merge:Bool <br>
 *   nx_cc_updated:Bool flags:(## 3) { flags = 0 } <br>
 *   next_catchain_seqno:uint32 next_validator_shard:uint64 <br>
 *   min_ref_mc_seqno:uint32 gen_utime:uint32 <br>
 *   split_merge_at:FutureSplitMerge <br>
 *   fees_collected:CurrencyCollection <br>
 *   funds_created:CurrencyCollection = ShardDescr; <br>
 * 
 * shard_descr_new#a seq_no:uint32 reg_mc_seqno:uint32 <br>
 *   start_lt:uint64 end_lt:uint64 <br>
 *   root_hash:bits256 file_hash:bits256  <br>
 *   before_split:Bool before_merge:Bool <br>
 *   want_split:Bool want_merge:Bool <br>
 *   nx_cc_updated:Bool flags:(## 3) { flags = 0 } <br>
 *   next_catchain_seqno:uint32 next_validator_shard:uint64 <br>
 *   min_ref_mc_seqno:uint32 gen_utime:uint32 <br>
 *   split_merge_at:FutureSplitMerge <br>
 *   ^[ fees_collected:CurrencyCollection <br>
 *      funds_created:CurrencyCollection ] = ShardDescr;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardDescr(cell, t) {
  const type = loadUint(cell, t, 4).toNumber();
  if (type !== 0xa && type !== 0xb)
    throw Error("not a ShardDescr");
  let data = {_:"ShardDescr"};
  data.seq_no = loadUint32(cell, t);
  data.reg_mc_seqno = loadUint32(cell, t);
  data.start_lt = loadUint64(cell, t);
  data.end_lt = loadUint64(cell, t);
  data.root_hash = loadBits(cell, t, 256);
  data.file_hash = loadBits(cell, t, 256);
  data.before_split = loadBool(cell, t);
  data.before_merge = loadBool(cell, t);
  data.want_split = loadBool(cell, t);
  data.want_merge = loadBool(cell, t);
  data.nx_cc_updated = loadBool(cell, t);
  data.flags = loadUint(cell, t, 3).toNumber();
  if (data.flags !== 0)
    throw Error("ShardDescr data.flags !== 0");
  data.next_catchain_seqno = loadUint32(cell, t);
  data.next_validator_shard = loadUint64(cell, t);
  data.min_ref_mc_seqno = loadUint32(cell, t);
  data.gen_utime = loadUint32(cell, t);
  data.split_merge_at = loadFutureSplitMerge(cell, t);
  if (type === 0xb) {
    data.fees_collected = loadCurrencyCollection(cell, t);
    data.funds_created = loadCurrencyCollection(cell, t);
  }
  else if (type === 0xa) {
    let cell_r1 = cell.refs[t.ref++];
    let tr1 = {cs: 0, ref: 0};
    if (cell_r1.type === Cell.OrdinaryCell) {
      data.fees_collected = loadCurrencyCollection(cell_r1, tr1);
      data.funds_created = loadCurrencyCollection(cell_r1, tr1);
    }
  }
  return data;
}

/**
 * Loads ShardHashes  <br>
 * 
 * _ (HashmapE 32 ^(BinTree ShardDescr)) = ShardHashes;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardHashes(cell, t) {
  return loadHashmapE(cell, t, 32, (c, p) => loadRefIfExist(c, p, (c2, p2) => loadBinTree(c2, p2, loadShardDescr)));
}

/**
 * Loads ShardFeeCreated  <br>
 * 
 * _ fees:CurrencyCollection create:CurrencyCollection = ShardFeeCreated;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardFeeCreated(cell, t) {
  let data = {_:"CurrencyCollection"};
  data.fees = loadCurrencyCollection(cell, t);
  data.create = loadCurrencyCollection(cell, t);
  return data;
}

/**
 * Loads ShardFees  <br>
 * 
 * _ (HashmapAugE 96 ShardFeeCreated ShardFeeCreated) = ShardFees;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadShardFees(cell, t) {
  return loadHashmapAugE(cell, t, 96, loadShardFeeCreated, loadShardFeeCreated);
}

/**
 * Loads CryptoSignature  <br>
 * 
 * ed25519_signature#5 R:bits256 s:bits256 = CryptoSignatureSimple;  // 516 bits <br>
 * _ CryptoSignatureSimple = CryptoSignature;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCryptoSignature(cell, t) {
  if (loadUint(cell, t, 4).toNumber() !== 0x5) {
    throw Error("not a CryptoSignatureSimple");
  }
  let data = {_:"CryptoSignatureSimple"};
  data.R = loadBits(cell, t, 256);
  data.s = loadBits(cell, t, 256);
  return data;
}

/**
 * Loads CryptoSignaturePair  <br>
 * 
 * sig_pair$_ node_id_short:bits256 sign:CryptoSignature = CryptoSignaturePair;  // 256+x ~ 772 bits
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadCryptoSignaturePair(cell, t) {
  let data = {_:"CryptoSignaturePair"};
  data.node_id_short = loadBits(cell, t, 256);
  data.sign = loadCryptoSignature(cell, t);
  return data;
}

function loadInMsg(cell, t) {
  cell;
  t;
  let data = {_:"InMsg"};     // TODO
  return data;
}
function loadInMsgDescr(cell, t) {
  cell;
  t;
  let data = {_:"InMsgDescr"};     // TODO
  return data;
}
function loadOutMsgDescr(cell, t) {
  cell;
  t;
  let data = {_:"OutMsgDescr"};     // TODO
  return data;
}

/**
 * Loads McBlockExtra  <br>
 * 
 * masterchain_block_extra#cca5 <br>
 *   key_block:(## 1) <br>
 *   shard_hashes:ShardHashes <br>
 *   shard_fees:ShardFees <br>
 *   ^[ prev_blk_signatures:(HashmapE 16 CryptoSignaturePair) <br>
 *      recover_create_msg:(Maybe ^InMsg) <br>
 *      mint_msg:(Maybe ^InMsg) ] <br>
 *   config:key_block?ConfigParams <br>
 * = McBlockExtra;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMcBlockExtra(cell, t) {
  if (loadUint16(cell, t) !== 0xcca5) {
    throw Error("not a McBlockExtra");
  }
  let data = {_:"McBlockExtra"};
  data.key_block = loadBit(cell, t);
  data.shard_hashes = loadShardHashes(cell, t);
  data.shard_fees = loadShardFees(cell, t);

  let cell_r1 = cell.refs[t.ref++];
  let tr1 = {cs: 0, ref: 0};
  if (cell_r1.type === Cell.OrdinaryCell) {
    data.prev_blk_signatures = loadHashmapE(cell_r1, tr1, 16, loadCryptoSignaturePair);
    data.recover_create_msg = loadMaybeRef(cell_r1, tr1, loadInMsg);
    data.mint_msg = loadMaybeRef(cell_r1, tr1, loadInMsg);
  }

  if (data.key_block)
    data.config = loadConfigParams(cell, t);
  return data;
}

/**
 * Loads BlockExtra  <br>
 * 
 * block_extra in_msg_descr:^InMsgDescr <br>
 *   out_msg_descr:^OutMsgDescr <br>
 *   account_blocks:^ShardAccountBlocks <br>
 *   rand_seed:bits256 <br>
 *   created_by:bits256 <br>
 *   custom:(Maybe ^McBlockExtra) = BlockExtra;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadBlockExtra(cell, t) {
  if (loadUint32(cell, t) !== 0x4a33f6fd) {
    throw Error("not a BlockExtra");
  }
  let data = {_:"BlockExtra"};
  data.in_msg_descr = loadRefIfExist(cell, t, loadInMsgDescr);
  data.out_msg_descr = loadRefIfExist(cell, t, loadOutMsgDescr);
  data.account_blocks = loadRefIfExist(cell, t, loadShardAccountBlocks);
  data.rand_seed = loadBits(cell, t, 256);
  data.created_by = loadBits(cell, t, 256);
  data.custom = loadMaybeRef(cell, t, loadMcBlockExtra);
  return data;
}

/**
 * Loads ValueFlow  <br>
 * 
 * value_flow ^[ from_prev_blk:CurrencyCollection  <br>
 *   to_next_blk:CurrencyCollection <br>
 *   imported:CurrencyCollection <br>
 *   exported:CurrencyCollection ] <br>
 *   fees_collected:CurrencyCollection <br>
 *   ^[ <br>
 *   fees_imported:CurrencyCollection <br>
 *   recovered:CurrencyCollection <br>
 *   created:CurrencyCollection <br>
 *   minted:CurrencyCollection <br>
 *   ] = ValueFlow;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadValueFlow(cell, t) {
  if (loadUint32(cell, t) !== 0xb8e48dfb)
    throw Error("not a ValueFlow");
  let data = {_:"ValueFlow"}; // TODO
  return data;
}

/**
 * Loads MERKLE_UPDATE  <br>
 * 
 * !merkle_update#02 {X:Type} old_hash:bits256 new_hash:bits256 <br>
 *   old:^X new:^X = MERKLE_UPDATE X;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadMERKLE_UPDATE(cell, t) {
  // exotic cell with type = 4
  if (loadUint8(cell, t) !== 0x04) {
    throw Error("not a MERKLE_UPDATE");
  }
  let data = {_:"MERKLE_UPDATE"};
  data.old_hash = loadBits(cell, t, 256);
  data.new_hash = loadBits(cell, t, 256);
  data.old = cell.refs[t.ref++]; // TODO
  data.new = cell.refs[t.ref++];
  return data;
}

/**
 * Loads Block  <br>
 * 
 * block#11ef55aa global_id:int32 <br>
 *   info:^BlockInfo value_flow:^ValueFlow <br>
 *   state_update:^(MERKLE_UPDATE ShardState)  <br>
 *   extra:^BlockExtra = Block;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @returns {Object}
 */
function loadBlock(cell) {
  let t = {cs: 0, ref: 0};
  if (loadUint32(cell, t) !== 0x11ef55aa) {
    throw Error("not a Block");
  }
  let data = {_:"Block"};
  data.global_id = loadInt32(cell, t);
  data.info = loadRefIfExist(cell, t, loadBlockInfo);
  data.value_flow = loadRefIfExist(cell, t, loadValueFlow);
  data.state_update = loadRefIfExist(cell, t, loadMERKLE_UPDATE); // TODO (type!)
  data.extra = loadRefIfExist(cell, t, loadBlockExtra);
  return data;
}



/**
 * Block parser helper class
 */
class BlockParser {

  /**
   * Parses block cell
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @returns {Object}
   */
  static parseBlock(cell) {
    return loadBlock(cell);
  }

  /**
   * Parses Shard state
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @returns {Object}
   */
  static parseShardState(cell) {
    return loadShardStateUnsplit(cell);
  }

  /**
   * Parses Shard hashes
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @returns {Object}
   */
  static parseShardHashes(cell) {
    return loadShardHashes(cell, {cs:0, ref:0});
  }

  /**
   * Parses Account
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @returns {Object}
   */
  static parseAccount(cell) {
    return loadAccount(cell, {cs:0, ref:0});
  }

  /**
   * Parses Transaction
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @returns {Object}
   */
  static parseTransaction(cell) {
    return loadTransaction(cell, {cs:0, ref:0});
  }

  /**
   * Parses Message
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @returns {Object}
   */
  static parseMessage(cell) {
    return loadMessage(cell, {cs:0, ref:0});
  }

  /**
   * Parses signature from message body (ABIv2 specific)
   * 
   * @throws {Error} Error object with description
   * @param {Object} any Message body
   * @returns {Object}
   */
  static parseSignature(any) {
    if (any._ !== 'Any')
      throw Error('not an any');

    let t = {cs: any.current_pos, ref: any.current_ref};

    let exist = loadBit(any.cell, t);
    if (!exist)
      throw Error('no signature');

    let signature = loadBits(any.cell, t, 512);
    return signature;
  }

  /**
   * Parses signature from message body
   * 
   * @throws {Error} Error object with description
   * @param {Object} any Message body
   * @returns {Object}
   */
  static parseSignatureClassic(any) {
    if (any._ !== 'Any')
      throw Error('not an any');

    let t = {cs: any.current_pos, ref: any.current_ref};

    let signature = loadBits(any.cell, t, 512);
    return signature;
  }

  /**
   * Checks block header
   * 
   * @throws {Error} Error object with description
   * @param {Cell} cell Cell to parse
   * @param {BlockId} blockId block id
   * @returns {Object}
   */
  static checkBlockHeader(cell, blockId) {
    if (cell.type !== Cell.MerkleProofCell) {
      throw Error("Not a MerkleProof block");
    }
    if (!compareBytes(new Uint8Array(blockId.root_hash.buffer), cell.refs[0].getHash(0))) {
      throw Error("Block header has incorrect root hash");
    }
    let block = loadBlock(cell.refs[0]);
    //console.log(block);
    if (block.info.version !== 0) {
      throw Error("Invalid BlockInfo version");
    }
    if (block.info.shard.workchain_id !== blockId.workchain) {
      throw Error("Invalid BlockInfo workchain");
    }
    if (!blockId.compareShard(block.info.shard.shard)) {
      throw Error("Invalid BlockInfo shard");
    }
    if (block.info.seq_no !== blockId.seqno) {
      throw Error("Invalid BlockInfo seqno");
    }
    //if (block.state_update._ !== 'MERKLE_UPDATE') {
    //    throw Error("No MerkleUpdate in block");
    //}

    // returns current ShardState of a block
    //return block.state_update.refs[1].getHash(0);
    return block;
  }

}

module.exports = {BlockParser};