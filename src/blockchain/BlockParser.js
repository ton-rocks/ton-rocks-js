const {BitString} = require("../types/BitString");
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
    loadInt16,
    loadInt32,
    loadBit,
    loadBits,
    loadUintLeq,
    loadUintLess,
    loadVarUInteger,
    loadGrams,
    loadRefIfExist,
    loadMaybe,
    loadMaybeRef
} = require("./BlockUtils");


function loadHashmap(cell, t, n, f) {
    let data = new Hashmap(n, f);
    data.deserialize(cell, t);
    return data;
}

function loadHashmapE(cell, t, n, f) {
    let data = new HashmapE(n, f);
    data.deserialize(cell, t);
    return data;
}

function loadHashmapAug(cell, t, n, f1, f2) {
    let data = new HashmapAug(n, (c,p) => {return {"extra": f2(c,p), "value": f1(c,p)};});
    data.deserialize(cell, t);
    return data;
}

function loadHashmapAugE(cell, t, n, f1, f2) {
    let data = new HashmapAugE(n, (c,p) => {return {"extra": f2(c,p), "value": f1(c,p)};});
    data.deserialize(cell, t);
    return data;
}

/*
bt_leaf$0 {X:Type} leaf:X = BinTree X;
bt_fork$1 {X:Type} left:^(BinTree X) right:^(BinTree X)
= BinTree X;
*/
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
function loadBinTree(cell, t, f) {
    let data = loadBinTreeR(cell, t, f);
    data._ = "BinTree";
    return data;
}


/*
_ config_addr:bits256 = ConfigParam 0;
*/
function loadConfigParam0(cell, t) {
    let data = {_:"ConfigParam", number: 0};
    data.config_addr = loadBits(cell, t, 256);
    return data;
}

/*
_ elector_addr:bits256 = ConfigParam 1;
*/
function loadConfigParam1(cell, t) {
    let data = {_:"ConfigParam", number: 1};
    data.elector_addr = loadBits(cell, t, 256);
    return data;
}

/*
_ minter_addr:bits256 = ConfigParam 2;
*/
function loadConfigParam2(cell, t) {
    let data = {_:"ConfigParam", number: 2};
    data.minter_addr = loadBits(cell, t, 256);
    return data;
}

/*
_ fee_collector_addr:bits256 = ConfigParam 3;  // ConfigParam 1 is used if absent
*/
function loadConfigParam3(cell, t) {
    let data = {_:"ConfigParam", number: 3};
    data.fee_collector_addr = loadBits(cell, t, 256);
    return data;
}

/*
_ dns_root_addr:bits256 = ConfigParam 4;  // root TON DNS resolver
*/
function loadConfigParam4(cell, t) {
    let data = {_:"ConfigParam", number: 4};
    data.dns_root_addr = loadBits(cell, t, 256);
    return data;
}

/*
_ mint_new_price:Grams mint_add_price:Grams = ConfigParam 6;
*/
function loadConfigParam6(cell, t) {
    let data = {_:"ConfigParam", number: 6};
    data.mint_new_price = loadGrams(cell, t);
    data.mint_add_price = loadGrams(cell, t);
    return data;
}

/*
_ to_mint:ExtraCurrencyCollection = ConfigParam 7;
*/
function loadConfigParam7(cell, t) {
    let data = {_:"ConfigParam", number: 7};
    data.to_mint = loadExtraCurrencyCollection(cell, t);
    return data;
}

/*
_ GlobalVersion = ConfigParam 8;  // all zero if absent
*/
function loadConfigParam8(cell, t) {
    let data = {_:"ConfigParam", number: 8};
    data.version = loadGlobalVersion(cell, t);
    return data;
}

/*
_ mandatory_params:(Hashmap 32 True) = ConfigParam 9;
*/
function loadConfigParam9(cell, t) {
    let data = {_:"ConfigParam", number: 9};
    data.mandatory_params = loadHashmap(cell, t, 32, (c,p) => true);
    return data;
}

/*
_ critical_params:(Hashmap 32 True) = ConfigParam 10;
*/
function loadConfigParam10(cell, t) {
    let data = {_:"ConfigParam", number: 10};
    data.critical_params = loadHashmap(cell, t, 32, (c,p) => true);
    return data;
}

/*
cfg_vote_cfg#36 min_tot_rounds:uint8 max_tot_rounds:uint8 min_wins:uint8 max_losses:uint8 min_store_sec:uint32 max_store_sec:uint32 bit_price:uint32 cell_price:uint32 = ConfigProposalSetup;
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

/*
cfg_vote_setup#91 normal_params:^ConfigProposalSetup critical_params:^ConfigProposalSetup = ConfigVotingSetup;
*/
function loadConfigVotingSetup(cell, t) {
    let data = {_:"ConfigVotingSetup"};
    if (loadUint8(cell, t) !== 0x91)
        throw Error('Not a ConfigVotingSetup');
    data.normal_params = loadRefIfExist(cell, t, loadConfigProposalSetup);
    data.critical_params = loadRefIfExist(cell, t, loadConfigProposalSetup);
    return data;
}

/*
_ ConfigVotingSetup = ConfigParam 11;
*/
function loadConfigParam11(cell, t) {
    let data = {_:"ConfigParam", number: 11};
    data.setup = loadConfigVotingSetup(cell, t);
    return data;
}

/*
wfmt_basic#1 vm_version:int32 vm_mode:uint64 = WorkchainFormat 1;
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

/*
workchain#a6 enabled_since:uint32 actual_min_split:(## 8) 
  min_split:(## 8) max_split:(## 8) { actual_min_split <= min_split }
//workchain#a5 enabled_since:uint32 min_split:(## 8) max_split:(## 8)
//  { min_split <= max_split } { max_split <= 60 }
  basic:(## 1) active:Bool accept_msgs:Bool flags:(## 13) { flags = 0 }
  zerostate_root_hash:bits256 zerostate_file_hash:bits256
  version:uint32 format:(WorkchainFormat basic)
  = WorkchainDescr;
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
    data.active = loadBit(cell, t);
    data.accept_msgs = loadBit(cell, t);
    data.flags = loadUint(cell, t, 13).toNumber();
    if (data.flags !== 0)
        throw Error('data.flags');
    data.zerostate_root_hash = loadBits(cell, t, 256);
    data.zerostate_file_hash = loadBits(cell, t, 256);
    data.version = loadUint32(cell, t);
    data.format = loadWorkchainFormat1(cell, t);
    return data;
}

/*
_ workchains:(HashmapE 32 WorkchainDescr) = ConfigParam 12;
*/
function loadConfigParam12(cell, t) {
    let data = {_:"ConfigParam", number: 12};
    data.workchains = loadHashmapE(cell, t, 32, loadWorkchainDescr);
    return data;
}

/*
complaint_prices#1a deposit:Grams bit_price:Grams cell_price:Grams = ComplaintPricing; 
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

/*
_ ComplaintPricing = ConfigParam 13;
*/
function loadConfigParam13(cell, t) {
    let data = {_:"ConfigParam", number: 13};
    data.pricing = loadComplaintPricing(cell, t);
    return data;
}

/*
block_grams_created#6b masterchain_block_fee:Grams basechain_block_fee:Grams
  = BlockCreateFees;
*/
function loadBlockCreateFees(cell, t) {
    let data = {_:"BlockCreateFees"};
    if (loadUint8(cell, t) !== 0x6b)
        throw Error('not a BlockCreateFees');
    data.masterchain_block_fee = loadGrams(cell, t);
    data.basechain_block_fee = loadGrams(cell, t);
    return data;
}

/*
_ BlockCreateFees = ConfigParam 14;
*/
function loadConfigParam14(cell, t) {
    let data = {_:"ConfigParam", number: 14};
    data.fees = loadBlockCreateFees(cell, t);
    return data;
}

/*
_ validators_elected_for:uint32 elections_start_before:uint32 
  elections_end_before:uint32 stake_held_for:uint32
  = ConfigParam 15;
*/
function loadConfigParam15(cell, t) {
    let data = {_:"ConfigParam", number: 15};
    data.validators_elected_for = loadUint32(cell, t);
    data.elections_start_before = loadUint32(cell, t);
    data.elections_end_before = loadUint32(cell, t);
    data.stake_held_for = loadUint32(cell, t);
    return data;
}

/*
_ max_validators:(## 16) max_main_validators:(## 16) min_validators:(## 16) 
  { max_validators >= max_main_validators } 
  { max_main_validators >= min_validators } 
  { min_validators >= 1 }
  = ConfigParam 16;
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

/*
_ min_stake:Grams max_stake:Grams min_total_stake:Grams max_stake_factor:uint32 = ConfigParam 17;
*/
function loadConfigParam17(cell, t) {
    let data = {_:"ConfigParam", number: 17};
    data.min_stake = loadGrams(cell, t);
    data.max_stake = loadGrams(cell, t);
    data.min_total_stake = loadGrams(cell, t);
    data.max_stake_factor = loadUint32(cell, t);
    return data;
}

/*
_#cc utime_since:uint32 bit_price_ps:uint64 cell_price_ps:uint64 
  mc_bit_price_ps:uint64 mc_cell_price_ps:uint64 = StoragePrices;
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

/*
_ (Hashmap 32 StoragePrices) = ConfigParam 18;
*/
function loadConfigParam18(cell, t) {
    let data = {_:"ConfigParam", number: 18};
    data.prices = loadHashmap(cell, t, 32, loadStoragePrices);
    return data;
}

/*
gas_prices#dd gas_price:uint64 gas_limit:uint64 gas_credit:uint64 
  block_gas_limit:uint64 freeze_due_limit:uint64 delete_due_limit:uint64 
  = GasLimitsPrices;

gas_prices_ext#de gas_price:uint64 gas_limit:uint64 special_gas_limit:uint64 gas_credit:uint64 
  block_gas_limit:uint64 freeze_due_limit:uint64 delete_due_limit:uint64 
  = GasLimitsPrices;

gas_flat_pfx#d1 flat_gas_limit:uint64 flat_gas_price:uint64 other:GasLimitsPrices
  = GasLimitsPrices;
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

/*
config_mc_gas_prices#_ GasLimitsPrices = ConfigParam 20;
*/
function loadConfigParam20(cell, t) {
    let data = {_:"ConfigParam", number: 20};
    data.prices = loadGasLimitsPrices(cell, t);
    return data;
}

/*
config_gas_prices#_ GasLimitsPrices = ConfigParam 21;
*/
function loadConfigParam21(cell, t) {
    let data = {_:"ConfigParam", number: 21};
    data.prices = loadGasLimitsPrices(cell, t);
    return data;
}

/*
param_limits#c3 underload:# soft_limit:# { underload <= soft_limit }
  hard_limit:# { soft_limit <= hard_limit } = ParamLimits;
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

/*
block_limits#5d bytes:ParamLimits gas:ParamLimits lt_delta:ParamLimits
  = BlockLimits;
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

/*
config_mc_block_limits#_ BlockLimits = ConfigParam 22;
*/
function loadConfigParam22(cell, t) {
    let data = {_:"ConfigParam", number: 22};
    data.limits = loadBlockLimits(cell, t);
    return data;
}

/*
config_block_limits#_ BlockLimits = ConfigParam 23;
*/
function loadConfigParam23(cell, t) {
    let data = {_:"ConfigParam", number: 23};
    data.limits = loadBlockLimits(cell, t);
    return data;
}

/*
// msg_fwd_fees = (lump_price + ceil((bit_price * msg.bits + cell_price * msg.cells)/2^16)) nanograms
// ihr_fwd_fees = ceil((msg_fwd_fees * ihr_price_factor)/2^16) nanograms
// bits in the root cell of a message are not included in msg.bits (lump_price pays for them)
msg_forward_prices#ea lump_price:uint64 bit_price:uint64 cell_price:uint64
  ihr_price_factor:uint32 first_frac:uint16 next_frac:uint16 = MsgForwardPrices;
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


/*
// used for messages to/from masterchain
config_mc_fwd_prices#_ MsgForwardPrices = ConfigParam 24;
*/
function loadConfigParam24(cell, t) {
    let data = {_:"ConfigParam", number: 24};
    data.prices = loadMsgForwardPrices(cell, t);
    return data;
}

/*
// used for all other messages
config_fwd_prices#_ MsgForwardPrices = ConfigParam 25;
*/
function loadConfigParam25(cell, t) {
    let data = {_:"ConfigParam", number: 25};
    data.prices = loadMsgForwardPrices(cell, t);
    return data;
}

/*
catchain_config#c1 mc_catchain_lifetime:uint32 shard_catchain_lifetime:uint32 
  shard_validators_lifetime:uint32 shard_validators_num:uint32 = CatchainConfig;

catchain_config_new#c2 flags:(## 7) { flags = 0 } shuffle_mc_validators:Bool
  mc_catchain_lifetime:uint32 shard_catchain_lifetime:uint32
  shard_validators_lifetime:uint32 shard_validators_num:uint32 = CatchainConfig;
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
        data.shuffle_mc_validators = loadBit(cell, t);
        data.mc_catchain_lifetime = loadUint32(cell, t);
        data.shard_catchain_lifetime = loadUint32(cell, t);
        data.shard_validators_lifetime = loadUint32(cell, t);
        data.shard_validators_num = loadUint32(cell, t);
        return data;
    }
    throw Error('not a CatchainConfig');
}

/*
_ CatchainConfig = ConfigParam 28;
*/
function loadConfigParam28(cell, t) {
    let data = {_:"ConfigParam", number: 28};
    data.catchain = loadCatchainConfig(cell, t);
    return data;
}

/*
consensus_config#d6 round_candidates:# { round_candidates >= 1 }
  next_candidate_delay_ms:uint32 consensus_timeout_ms:uint32
  fast_attempts:uint32 attempt_duration:uint32 catchain_max_deps:uint32
  max_block_bytes:uint32 max_collated_bytes:uint32 = ConsensusConfig;

consensus_config_new#d7 flags:(## 7) { flags = 0 } new_catchain_ids:Bool
  round_candidates:(## 8) { round_candidates >= 1 }
  next_candidate_delay_ms:uint32 consensus_timeout_ms:uint32
  fast_attempts:uint32 attempt_duration:uint32 catchain_max_deps:uint32
  max_block_bytes:uint32 max_collated_bytes:uint32 = ConsensusConfig;
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
        data.new_catchain_ids = loadBit(cell, t);
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

/*
_ ConsensusConfig = ConfigParam 29;
*/
function loadConfigParam29(cell, t) {
    let data = {_:"ConfigParam", number: 29};
    data.consensus = loadConsensusConfig(cell, t);
    return data;
}

/*
_ fundamental_smc_addr:(HashmapE 256 True) = ConfigParam 31;
*/
function loadConfigParam31(cell, t) {
    let data = {_:"ConfigParam", number: 31};
    data.fundamental_smc_addr = loadHashmapE(cell, t, 256, (c,p) => true);
    return data;
}

/*
ed25519_pubkey#8e81278a pubkey:bits256 = SigPubKey;  // 288 bits
*/
function loadSigPubKey(cell, t) {
    let data = {_:"SigPubKey"};
    if (loadUint32(cell, t) !== 0x8e81278a)
        throw Error('not a SigPubKey');
    data.pubkey = loadBits(cell, t, 256);
    return data;
}

/*
validator#53 public_key:SigPubKey weight:uint64 = ValidatorDescr;
validator_addr#73 public_key:SigPubKey weight:uint64 adnl_addr:bits256 = ValidatorDescr;
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

/*
validators#11 utime_since:uint32 utime_until:uint32 
  total:(## 16) main:(## 16) { main <= total } { main >= 1 } 
  list:(Hashmap 16 ValidatorDescr) = ValidatorSet;
validators_ext#12 utime_since:uint32 utime_until:uint32 
  total:(## 16) main:(## 16) { main <= total } { main >= 1 } 
  total_weight:uint64 list:(HashmapE 16 ValidatorDescr) = ValidatorSet;
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

/*
_ prev_validators:ValidatorSet = ConfigParam 32;
*/
function loadConfigParam32(cell, t) {
    let data = {_:"ConfigParam", number: 32};
    data.prev_validators = loadValidatorSet(cell, t);
    return data;
}

/*
_ prev_temp_validators:ValidatorSet = ConfigParam 33;
*/
function loadConfigParam33(cell, t) {
    let data = {_:"ConfigParam", number: 33};
    data.prev_temp_validators = loadValidatorSet(cell, t);
    return data;
}

/*
_ cur_validators:ValidatorSet = ConfigParam 34;
*/
function loadConfigParam34(cell, t) {
    let data = {_:"ConfigParam", number: 34};
    data.cur_validators = loadValidatorSet(cell, t);
    return data;
}

/*
_ cur_temp_validators:ValidatorSet = ConfigParam 35;
*/
function loadConfigParam35(cell, t) {
    let data = {_:"ConfigParam", number: 35};
    data.cur_temp_validators = loadValidatorSet(cell, t);
    return data;
}

/*
_ next_validators:ValidatorSet = ConfigParam 36;
*/
function loadConfigParam36(cell, t) {
    let data = {_:"ConfigParam", number: 36};
    data.next_validators = loadValidatorSet(cell, t);
    return data;
}

/*
_ next_temp_validators:ValidatorSet = ConfigParam 37;
*/
function loadConfigParam37(cell, t) {
    let data = {_:"ConfigParam", number: 37};
    data.next_temp_validators = loadValidatorSet(cell, t);
    return data;
}



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


/*
extra_currencies$_ dict:(HashmapE 32 (VarUInteger 32)) 
             = ExtraCurrencyCollection;
*/
function loadExtraCurrencyCollection(cell, t) {
    let data = {_:"ExtraCurrencyCollection"};
    data.dict = loadHashmapE(cell, t, 32, (c,p) => loadVarUInteger(c, p, 32));
    return data;
}

/*
currencies$_ grams:Grams other:ExtraCurrencyCollection 
           = CurrencyCollection;
*/
function loadCurrencyCollection(cell, t) {
    let data = {_:"CurrencyCollection"};
    data.grams = loadGrams(cell, t);
    data.other = loadExtraCurrencyCollection(cell, t);
    return data;
}


/*
shard_ident$00 shard_pfx_bits:(#<= 60) 
    workchain_id:int32 shard_prefix:uint64 = ShardIdent;
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

/*
block_id_ext$_ shard_id:ShardIdent seq_no:uint32
    root_hash:bits256 file_hash:bits256 = BlockIdExt;
*/
function loadBlockIdExt(cell, t) {
    let data = {_:"BlockIdExt"};
    data.shard_id = loadShardIdent(cell, t);
    data.seq_no = loadUint32(cell, t);
    data.root_hash = loadBits(cell, t, 256);
    data.file_hash = loadBits(cell, t, 256);
    return data;
}

/*
ext_blk_ref$_ end_lt:uint64
  seq_no:uint32 root_hash:bits256 file_hash:bits256 
  = ExtBlkRef;
*/
function loadExtBlkRef(cell, t) {
    let data = {_:"ExtBlkRef"};
    data.end_lt = loadUint64(cell, t);
    data.seq_no = loadUint32(cell, t);
    data.root_hash = loadBits(cell, t, 256);
    data.file_hash = loadBits(cell, t, 256);
    return data;
}

/*
master_info$_ master:ExtBlkRef = BlkMasterInfo;
*/
function loadBlkMasterInfo(cell, t) {
    let data = {_:"BlkMasterInfo"};
    data.master = loadExtBlkRef(cell, t);
    return data;
}

/*
anycast_info$_ depth:(#<= 30) { depth >= 1 }
    rewrite_pfx:(bits depth) = Anycast;
*/
function loadAnycast(cell, t) {
    let data = {_:"Anycast"};
    data.depth = loadUintLeq(cell, t, 30);
    if (data.depth < 1)
        throw Error("data.depth < 1");
    data.rewrite_pfx = loadBits(cell, t, data.depth);
}

/*
addr_std$10 anycast:(Maybe Anycast) 
   workchain_id:int8 address:bits256  = MsgAddressInt;
addr_var$11 anycast:(Maybe Anycast) addr_len:(## 9) 
   workchain_id:int32 address:(bits addr_len) = MsgAddressInt;
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

/*
storage_used$_ cells:(VarUInteger 7) bits:(VarUInteger 7) 
    public_cells:(VarUInteger 7) = StorageUsed;
*/
function loadStorageUsed(cell, t) {
    let data = {_:"StorageUsed"};
    data.cells = loadVarUInteger(cell, t, 7);
    data.bits = loadVarUInteger(cell, t, 7);
    data.public_cells = loadVarUInteger(cell, t, 7);
    return data;
}

/*
storage_info$_ used:StorageUsed last_paid:uint32
          due_payment:(Maybe Grams) = StorageInfo;
*/
function loadStorageInfo(cell, t) {
    let data = {_:"StorageInfo"};
    data.used = loadStorageUsed(cell, t);
    data.last_paid = loadUint32(cell, t);
    data.due_payment = loadMaybe(cell, t, loadGrams);
    return data;
}

/*
tick_tock$_ tick:Bool tock:Bool = TickTock;
*/
function loadTickTock(cell, t) {
    let data = {_:"TickTock"};
    data.tick = loadBit(cell, t);
    data.tock = loadBit(cell, t);
    return data;
}

/*
_ split_depth:(Maybe (## 5)) special:(Maybe TickTock)
    code:(Maybe ^Cell) data:(Maybe ^Cell)
    library:(HashmapE 256 SimpleLib) = StateInit;
*/
function loadStateInit(cell, t) {
    let data = {_:"StateInit"};
    data.split_depth = loadMaybe(cell, t, loadUint, [5]);
    data.special = loadMaybe(cell, t, loadTickTock);
    data.code = loadMaybeRef(cell, t, (c, p) => c);
    data.data = loadMaybeRef(cell, t, (c, p) => c);
    data.library = loadMaybe(cell, t, (c, p) => loadHashmapE(c, p, 256, (c2, p2) => c2)); // TODO SimpleLib
    return data;
}

/*
account_uninit$00 = AccountState;
account_active$1 _:StateInit = AccountState;
account_frozen$01 state_hash:bits256 = AccountState;
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

/*
account_storage$_ last_trans_lt:uint64
    balance:CurrencyCollection state:AccountState 
  = AccountStorage;
*/
function loadAccountStorage(cell, t) {
    let data = {_:"AccountState"};
    data.last_trans_lt = loadUint64(cell, t);
    data.balance = loadCurrencyCollection(cell, t);
    data.state = loadAccountState(cell, t);
    return data;
}

/*
account_none$0 = Account;
account$1 addr:MsgAddressInt storage_stat:StorageInfo
      storage:AccountStorage = Account;
*/
function loadAccount(cell, t) {
    if (cell.type === Cell.PrunnedBranchCell)
        return cell;
    let data = {_:"Account"};
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

/*
account_descr$_ account:^Account last_trans_hash:bits256 
  last_trans_lt:uint64 = ShardAccount;
*/
function loadShardAccount(cell, t) {
    let data = {_:"ShardAccount"};
    data.account = loadAccount(cell.refs[t.ref++], {cs:0, ref:0});
    data.last_trans_hash = loadBits(cell, t, 256);
    data.last_trans_lt = loadUint64(cell, t);
    return data;
}

/*
depth_balance$_ split_depth:(#<= 30) balance:CurrencyCollection = DepthBalanceInfo;
*/
function loadDepthBalanceInfo(cell, t) {
    let data = {_:"DepthBalanceInfo"};
    data.split_depth = loadUintLeq(cell, t, 30);
    data.balance = loadCurrencyCollection(cell, t);
    return data;
}

/*
_ (HashmapAugE 256 ShardAccount DepthBalanceInfo) = ShardAccounts;
*/
function loadShardAccounts(cell, t) {
    return loadHashmapAugE(cell, t, 256, loadShardAccount, loadDepthBalanceInfo);
}

/*
update_hashes#72 {X:Type} old_hash:bits256 new_hash:bits256
    = HASH_UPDATE X;
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

/*
acst_unchanged$0 = AccStatusChange;  // x -> x
acst_frozen$10 = AccStatusChange;    // init -> frozen
acst_deleted$11 = AccStatusChange;   // frozen -> deleted
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

/*
tr_phase_storage$_ storage_fees_collected:Grams 
  storage_fees_due:(Maybe Grams)
  status_change:AccStatusChange
  = TrStoragePhase;
*/
function loadTrStoragePhase(cell, t) {
    let data = {_:"TrStoragePhase"};
    data.storage_fees_collected = loadGrams(cell, t);
    data.storage_fees_due = loadMaybe(cell, t, loadGrams);
    data.status_change = loadAccStatusChange(cell, t);
    return data;
}

/*
tr_phase_credit$_ due_fees_collected:(Maybe Grams)
  credit:CurrencyCollection = TrCreditPhase;
*/
function loadTrCreditPhase(cell, t) {
    let data = {_:"TrCreditPhase"};
    data.due_fees_collected = loadMaybe(cell, t, loadGrams);
    data.credit = loadCurrencyCollection(cell, t);
    return data;
}

/*
storage_used_short$_ cells:(VarUInteger 7) 
  bits:(VarUInteger 7) = StorageUsedShort;
*/
function loadStorageUsedShort(cell, t) {
    let data = {_:"StorageUsedShort"};
    data.cells = loadVarUInteger(cell, t, 7);
    data.bits = loadVarUInteger(cell, t, 7);
    return data;
}

/*
tr_phase_action$_ success:Bool valid:Bool no_funds:Bool
  status_change:AccStatusChange
  total_fwd_fees:(Maybe Grams) total_action_fees:(Maybe Grams)
  result_code:int32 result_arg:(Maybe int32) tot_actions:uint16
  spec_actions:uint16 skipped_actions:uint16 msgs_created:uint16 
  action_list_hash:bits256 tot_msg_size:StorageUsedShort 
  = TrActionPhase;
*/
function loadTrActionPhase(cell, t) {
    let data = {_:"TrActionPhase"};
    data.success = loadBit(cell, t);
    data.valid = loadBit(cell, t);
    data.no_funds = loadBit(cell, t);
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

/*
tr_phase_bounce_negfunds$00 = TrBouncePhase;
tr_phase_bounce_nofunds$01 msg_size:StorageUsedShort
  req_fwd_fees:Grams = TrBouncePhase;
tr_phase_bounce_ok$1 msg_size:StorageUsedShort 
  msg_fees:Grams fwd_fees:Grams = TrBouncePhase;
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

/*
cskip_no_state$00 = ComputeSkipReason;
cskip_bad_state$01 = ComputeSkipReason;
cskip_no_gas$10 = ComputeSkipReason;
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

/*
tr_phase_compute_skipped$0 reason:ComputeSkipReason
  = TrComputePhase;
tr_phase_compute_vm$1 success:Bool msg_state_used:Bool 
  account_activated:Bool gas_fees:Grams
  ^[ gas_used:(VarUInteger 7)
  gas_limit:(VarUInteger 7) gas_credit:(Maybe (VarUInteger 3))
  mode:int8 exit_code:int32 exit_arg:(Maybe int32)
  vm_steps:uint32
  vm_init_state_hash:bits256 vm_final_state_hash:bits256 ]
  = TrComputePhase;
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
        data.success = loadBit(cell, t);
        data.msg_state_used = loadBit(cell, t);
        data.account_activated = loadBit(cell, t);
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

/*
trans_ord$0000 credit_first:Bool
  storage_ph:(Maybe TrStoragePhase)
  credit_ph:(Maybe TrCreditPhase)
  compute_ph:TrComputePhase action:(Maybe ^TrActionPhase)
  aborted:Bool bounce:(Maybe TrBouncePhase)
  destroyed:Bool
  = TransactionDescr;

trans_storage$0001 storage_ph:TrStoragePhase
  = TransactionDescr;

trans_tick_tock$001 is_tock:Bool storage_ph:TrStoragePhase
  compute_ph:TrComputePhase action:(Maybe ^TrActionPhase)
  aborted:Bool destroyed:Bool = TransactionDescr;
*/
function loadTransactionDescr(cell, t) {
    const type = loadUint(cell, t, 3).toNumber();
    let data = {_:"TransactionDescr"};
    if (type === 0) {
        const type2 = loadBit(cell, t);
        if (type2 === 0) {
            // trans_ord
            data.type = "ord";
            data.credit_first = loadBit(cell, t);
            data.storage_ph = loadMaybe(cell, t, loadTrStoragePhase);
            data.credit_ph = loadMaybe(cell, t, loadTrCreditPhase);
            data.compute_ph = loadTrComputePhase(cell, t);
            data.action = loadMaybeRef(cell, t, loadTrActionPhase);
            data.aborted = loadBit(cell, t);
            data.bounce = loadMaybe(cell, t, loadTrBouncePhase);
            data.destroyed = loadBit(cell, t);
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
        data.is_tock = loadBit(cell, t);
        data.storage_ph = loadTrStoragePhase(cell, t);
        data.compute_ph = loadTrComputePhase(cell, t);
        data.action = loadMaybeRef(cell, t, loadTrActionPhase);
        data.aborted = loadBit(cell, t);
        data.destroyed = loadBit(cell, t);
        return data;
    }
    throw Error("not a TransactionDescr");
}

/*
acc_state_uninit$00 = AccountStatus;
acc_state_frozen$01 = AccountStatus;
acc_state_active$10 = AccountStatus;
acc_state_nonexist$11 = AccountStatus;
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

function loadMessage(cell, t) {
    let data = {_:"Message"};  // TODO
    return data;
}

/*
transaction$0111 account_addr:bits256 lt:uint64 
  prev_trans_hash:bits256 prev_trans_lt:uint64 now:uint32
  outmsg_cnt:uint15
  orig_status:AccountStatus end_status:AccountStatus
  ^[ in_msg:(Maybe ^(Message Any)) out_msgs:(HashmapE 15 ^(Message Any)) ]
  total_fees:CurrencyCollection state_update:^(HASH_UPDATE Account)
  description:^TransactionDescr = Transaction;
*/
function loadTransaction(cell, t) {
    if (loadUint(cell, t, 4).toNumber() !== 7) {
        throw Error("not a Transaction");
    }
    let data = {_:"Transaction"};
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


/*
acc_trans#5 account_addr:bits256
        transactions:(HashmapAug 64 ^Transaction CurrencyCollection)
        state_update:^(HASH_UPDATE Account)
      = AccountBlock;
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

/*
_ (HashmapAugE 256 AccountBlock CurrencyCollection) = ShardAccountBlocks;
*/
function loadShardAccountBlocks(cell, t) {
    return loadHashmapAugE(cell, t, 256, loadAccountBlock, loadCurrencyCollection);
}

/*
_ config_addr:bits256 config:^(Hashmap 32 ^Cell) 
  = ConfigParams;
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

/*
validator_info$_
  validator_list_hash_short:uint32 
  catchain_seqno:uint32
  nx_cc_updated:Bool
= ValidatorInfo;
*/
function loadValidatorInfo(cell, t) {
    let data = {_:"ValidatorInfo"};
    data.validator_list_hash_short = loadUint32(cell, t);
    data.catchain_seqno = loadUint32(cell, t);
    data.nx_cc_updated = loadBit(cell, t);
    return data;
}

/*
_ key:Bool blk_ref:ExtBlkRef = KeyExtBlkRef;
*/
function loadKeyExtBlkRef(cell, t) {
    let data = {_:"KeyExtBlkRef"};
    data.key = loadBit(cell, t);
    data.blk_ref = loadExtBlkRef(cell, t);
    return data;
}

/*
_ key:Bool max_end_lt:uint64 = KeyMaxLt;
*/
function loadKeyMaxLt(cell, t) {
    let data = {_:"KeyExtKeyMaxLtBlkRef"};
    data.key = loadBit(cell, t);
    data.max_end_lt = loadUint64(cell, t);
    return data;
}

/*
_ (HashmapAugE 32 KeyExtBlkRef KeyMaxLt) = OldMcBlocksInfo;
*/
function loadOldMcBlocksInfo(cell, t) {
    return loadHashmapAugE(cell, t, 32, loadKeyExtBlkRef, loadKeyMaxLt);
}

/*
counters#_ last_updated:uint32 total:uint64 cnt2048:uint64 cnt65536:uint64 = Counters; 
*/
function loadCounters(cell, t) {
    let data = {_:"Counters"};
    data.last_updated = loadUint32(cell, t);
    data.total = loadUint64(cell, t);
    data.cnt2048 = loadUint64(cell, t);
    data.cnt65536 = loadUint64(cell, t);
    return data;
}

/*
creator_info#4 mc_blocks:Counters shard_blocks:Counters = CreatorStats; 
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

/*
block_create_stats#17 counters:(HashmapE 256 CreatorStats) = BlockCreateStats;
block_create_stats_ext#34 counters:(HashmapAugE 256 CreatorStats uint32) = BlockCreateStats;
*/
function loadBlockCreateStats(cell, t) {
    let data = {_:"BlockCreateStats"};  // TODO
    let type = loadUint8(cell, t);
    if (type === 0x17) {
        data.type = 'stats';
        data.counters = loadHashmapE(cell, t, 256, loadCreatorStats);
    }
    else if (type === 0x34) {
        data.type = 'stats_ext';
        data.counters = loadHashmapAugE(cell, t, 256, loadCreatorStats, loadUint32);
    }
    return data;
}

/*
masterchain_state_extra#cc26
  shard_hashes:ShardHashes
  config:ConfigParams
  ^[ flags:(## 16) { flags <= 1 }
     validator_info:ValidatorInfo
     prev_blocks:OldMcBlocksInfo
     after_key_block:Bool
     last_key_block:(Maybe ExtBlkRef)
     block_create_stats:(flags . 0)?BlockCreateStats ]
  global_balance:CurrencyCollection
= McStateExtra;
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
        data.after_key_block = loadBit(cell_r1, tr1);
        data.last_key_block = loadMaybe(cell_r1, tr1, loadExtBlkRef);
        if (data.flags & 1)
            data.block_create_stats = loadBlockCreateStats(cell_r1, tr1);
    }

    data.global_balance = loadCurrencyCollection(cell, t);
    return data;
}


/*
shard_state#9023afe2 global_id:int32
  shard_id:ShardIdent 
  seq_no:uint32 vert_seq_no:#
  gen_utime:uint32 gen_lt:uint64
  min_ref_mc_seqno:uint32
  out_msg_queue_info:^OutMsgQueueInfo
  before_split:(## 1)
  accounts:^ShardAccounts
  ^[ overload_history:uint64 underload_history:uint64
  total_balance:CurrencyCollection
  total_validator_fees:CurrencyCollection
  libraries:(HashmapE 256 LibDescr)
  master_ref:(Maybe BlkMasterInfo) ]
  custom:(Maybe ^McStateExtra)
  = ShardStateUnsplit;
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
        data.libraries = loadHashmapE(cell_r1, tr1, 256, (c,p) => c);
        data.master_ref = loadMaybe(cell_r1, tr1, loadBlkMasterInfo);
    }

    data.custom = loadMaybeRef(cell, t, loadMcStateExtra);
    return data;
}


/*
capabilities#c4 version:uint32 capabilities:uint64 = GlobalVersion;
*/
function loadGlobalVersion(cell, t) {
    if (loadUint8(cell, t) !== 0xc4)
        throw Error("not a GlobalVersion");
    let data = {_:"GlobalVersion"};
    data.version = loadUint32(cell, t);
    data.capabilities = loadUint64(cell, t);
    return data;
}

/*
prev_blk_info$_ prev:ExtBlkRef = BlkPrevInfo 0;
prev_blks_info$_ prev1:^ExtBlkRef prev2:^ExtBlkRef = BlkPrevInfo 1;
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

/*
block_info#9bc7a987 version:uint32 
  not_master:(## 1) 
  after_merge:(## 1) before_split:(## 1) 
  after_split:(## 1) 
  want_split:Bool want_merge:Bool
  key_block:Bool vert_seqno_incr:(## 1)
  flags:(## 8) { flags <= 1 }
  seq_no:# vert_seq_no:# { vert_seq_no >= vert_seqno_incr } 
  { prev_seq_no:# } { ~prev_seq_no + 1 = seq_no } 
  shard:ShardIdent gen_utime:uint32
  start_lt:uint64 end_lt:uint64
  gen_validator_list_hash_short:uint32
  gen_catchain_seqno:uint32
  min_ref_mc_seqno:uint32
  prev_key_block_seqno:uint32
  gen_software:flags . 0?GlobalVersion
  master_ref:not_master?^BlkMasterInfo 
  prev_ref:^(BlkPrevInfo after_merge)
  prev_vert_ref:vert_seqno_incr?^(BlkPrevInfo 0)
  = BlockInfo;
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
    data.want_split = loadBit(cell, t);
    data.want_merge = loadBit(cell, t);
    data.key_block = loadBit(cell, t);
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


/*
fsm_none$0 = FutureSplitMerge;
fsm_split$10 split_utime:uint32 interval:uint32 = FutureSplitMerge;
fsm_merge$11 merge_utime:uint32 interval:uint32 = FutureSplitMerge;
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

/*
shard_descr#b seq_no:uint32 reg_mc_seqno:uint32
  start_lt:uint64 end_lt:uint64
  root_hash:bits256 file_hash:bits256 
  before_split:Bool before_merge:Bool
  want_split:Bool want_merge:Bool
  nx_cc_updated:Bool flags:(## 3) { flags = 0 }
  next_catchain_seqno:uint32 next_validator_shard:uint64
  min_ref_mc_seqno:uint32 gen_utime:uint32
  split_merge_at:FutureSplitMerge
  fees_collected:CurrencyCollection
  funds_created:CurrencyCollection = ShardDescr;

shard_descr_new#a seq_no:uint32 reg_mc_seqno:uint32
  start_lt:uint64 end_lt:uint64
  root_hash:bits256 file_hash:bits256 
  before_split:Bool before_merge:Bool
  want_split:Bool want_merge:Bool
  nx_cc_updated:Bool flags:(## 3) { flags = 0 }
  next_catchain_seqno:uint32 next_validator_shard:uint64
  min_ref_mc_seqno:uint32 gen_utime:uint32
  split_merge_at:FutureSplitMerge
  ^[ fees_collected:CurrencyCollection
     funds_created:CurrencyCollection ] = ShardDescr;
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
    data.before_split = loadBit(cell, t);
    data.before_merge = loadBit(cell, t);
    data.want_split = loadBit(cell, t);
    data.want_merge = loadBit(cell, t);
    data.nx_cc_updated = loadBit(cell, t);
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

/*
_ (HashmapE 32 ^(BinTree ShardDescr)) = ShardHashes;
*/
function loadShardHashes(cell, t) {
    return loadHashmapE(cell, t, 32, (c, p) => loadRefIfExist(c, p, (c2, p2) => loadBinTree(c2, p2, loadShardDescr)));
}

/*
_ fees:CurrencyCollection create:CurrencyCollection = ShardFeeCreated;
*/
function loadShardFeeCreated(cell, t) {
    let data = {_:"CurrencyCollection"};
    data.fees = loadCurrencyCollection(cell, t);
    data.create = loadCurrencyCollection(cell, t);
    return data;
}

/*
_ (HashmapAugE 96 ShardFeeCreated ShardFeeCreated) = ShardFees;
*/
function loadShardFees(cell, t) {
    return loadHashmapAugE(cell, t, 96, loadShardFeeCreated, loadShardFeeCreated);
}

/*
ed25519_signature#5 R:bits256 s:bits256 = CryptoSignatureSimple;  // 516 bits
_ CryptoSignatureSimple = CryptoSignature;
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

/*
sig_pair$_ node_id_short:bits256 sign:CryptoSignature = CryptoSignaturePair;  // 256+x ~ 772 bits
*/
function loadCryptoSignaturePair(cell, t) {
    let data = {_:"CryptoSignaturePair"};
    data.node_id_short = loadBits(cell, t, 256);
    data.sign = loadCryptoSignature(cell, t);
    return data;
}

function loadInMsg(cell, t) {
    let data = {_:"InMsg"};     // TODO
    return data;
}
function loadInMsgDescr(cell, t) {
    let data = {_:"InMsgDescr"};     // TODO
    return data;
}
function loadOutMsgDescr(cell, t) {
    let data = {_:"OutMsgDescr"};     // TODO
    return data;
}

/*
masterchain_block_extra#cca5
  key_block:(## 1)
  shard_hashes:ShardHashes
  shard_fees:ShardFees
  ^[ prev_blk_signatures:(HashmapE 16 CryptoSignaturePair)
     recover_create_msg:(Maybe ^InMsg)
     mint_msg:(Maybe ^InMsg) ]
  config:key_block?ConfigParams
= McBlockExtra;
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

/*
block_extra in_msg_descr:^InMsgDescr
  out_msg_descr:^OutMsgDescr
  account_blocks:^ShardAccountBlocks
  rand_seed:bits256
  created_by:bits256
  custom:(Maybe ^McBlockExtra) = BlockExtra;
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

/*
value_flow ^[ from_prev_blk:CurrencyCollection 
  to_next_blk:CurrencyCollection
  imported:CurrencyCollection
  exported:CurrencyCollection ]
  fees_collected:CurrencyCollection
  ^[
  fees_imported:CurrencyCollection
  recovered:CurrencyCollection
  created:CurrencyCollection
  minted:CurrencyCollection
  ] = ValueFlow;
*/
function loadValueFlow(cell, t) {
    if (loadUint32(cell, t) !== 0xb8e48dfb)
        throw Error("not a ValueFlow");
    let data = {_:"ValueFlow"}; // TODO
    return data;
}

/*
!merkle_update#02 {X:Type} old_hash:bits256 new_hash:bits256
  old:^X new:^X = MERKLE_UPDATE X;
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

/*
block#11ef55aa global_id:int32
  info:^BlockInfo value_flow:^ValueFlow
  state_update:^(MERKLE_UPDATE ShardState) 
  extra:^BlockExtra = Block;
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




class BlockParser {

    static parseBlock(cell) {
        return loadBlock(cell);
    }

    static parseShardState(cell) {
        return loadShardStateUnsplit(cell);
    }

    static parseShardHashes(cell) {
        return loadShardHashes(cell, {cs:0, ref:0});
    }

    static parseAccount(cell) {
        return loadAccount(cell, {cs:0, ref:0});
    }

    static parseTransaction(cell) {
        return loadTransaction(cell, {cs:0, ref:0});
    }

    static checkBlockHeader(cell, blockId) {
        if (cell.type !== Cell.MerkleProofCell) {
            throw Error("Not a MerkleProof block");
        }
        if (!compareBytes(new Uint8Array(blockId.root_hash.buffer), cell.refs[0].getHash(0))) {
            throw Error("Block header has incorrect root hash");
        }
        let block = loadBlock(cell.refs[0]);
        console.log(block);
        if (block.info.version !== 0) {
            throw Error("Invalid BlockInfo version");
        }
        if (block.info.shard.workchain_id !== blockId.workchain) {
            throw Error("Invalid BlockInfo workchain");
        }
        if (!compareShard(block.info.shard, blockId.shard)) {
            throw Error("Invalid BlockInfo shard");
        }
        if (block.info.seq_no !== blockId.seqno) {
            throw Error("Invalid BlockInfo seqno");
        }
        if (block.state_update.type !== Cell.MerkleUpdateCell) {
            throw Error("No MerkleUpdate in block");
        }

        // returns current ShardState of a block
        //return block.state_update.refs[1].getHash(0);
        return block;
    }

}

module.exports = {BlockParser};