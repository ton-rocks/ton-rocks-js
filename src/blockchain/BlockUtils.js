const {Cell} = require("../types/Cell");


/**
 * Loads Uint
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {BN}
 */
function loadUint(cell, t, n) {
    if (t.cs + n > cell.bits.cursor)
        throw Error("cannot load uint");
    const i = cell.bits.readUint(t.cs, n); t.cs += n;
    return i;
}

/**
 * Loads Uint8
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadUint8(cell, t) {
    return loadUint(cell, t, 8).toNumber();
}

/**
 * Loads Uint16
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadUint16(cell, t) {
    return loadUint(cell, t, 16).toNumber();
}

/**
 * Loads Uint32
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadUint32(cell, t) {
    return loadUint(cell, t, 32).toNumber();
}

/**
 * Loads Uint64
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {BN}
 */
function loadUint64(cell, t) {
    return loadUint(cell, t, 64);
}

/**
 * Loads Int8
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadInt8(cell, t) {
    if (t.cs + 8 > cell.bits.cursor)
        throw Error("cannot load int8");
    const i = cell.bits.readInt8(t.cs); t.cs += 8;
    return i;
}

/**
 * Loads Int16
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadInt16(cell, t) {
    if (t.cs + 16 > cell.bits.cursor)
        throw Error("cannot load int16");
    const i = cell.bits.readInt16(t.cs); t.cs += 16;
    return i;
}

/**
 * Loads Int32
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadInt32(cell, t) {
    if (t.cs + 32 > cell.bits.cursor)
        throw Error("cannot load int32");
    const i = cell.bits.readInt32(t.cs); t.cs += 32;
    return i;
}

/**
 * Loads Bit
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadBit(cell, t) {
    if (t.cs + 1 > cell.bits.cursor)
        throw Error("cannot load bit");
    return cell.bits.get(t.cs++) ? 1 : 0;
}

/**
 * Loads Bits
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Uint8Array}
 */
function loadBits(cell, t, n) {
    if (t.cs + n > cell.bits.cursor)
        throw Error("cannot load bits");
    const bits = cell.bits.getRange(t.cs, n);
    t.cs += n;
    return bits;
}

/**
 * Loads Bool
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {boolean}
 */
function loadBool(cell, t) {
    if (t.cs + 1 > cell.bits.cursor)
        throw Error("cannot load Bool");
    return cell.bits.get(t.cs++) ? true : false;
}

/**
 * Loads UintLeq
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadUintLeq(cell, t, n) {
    let last_one = -1;
    let l = 1;
    for (let i = 0; i < 32; i++) {
        if (n & l) {
            last_one = i;
        }
        l = l << 1;
    }
    if (last_one === -1)
        throw Error("not a UintLe");
    last_one++;
    let data = loadUint(cell, t, last_one).toNumber();
    return data;
}

/**
 * Loads UintLess
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {number}
 */
function loadUintLess(cell, t, n) {
    return loadUintLeq(cell, t, n-1);
}

/**
 * Loads VarUInteger  <br>
 * 
 * var_uint$_ {n:#} len:(#< n) value:(uint (len * 8)) <br>
 *      = VarUInteger n;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadVarUInteger(cell, t, n) {
    let data = {_:"VarUInteger"};
    data.len = loadUintLess(cell, t, n);
    if (data.len === 0)
        data.value = 0;
    else
        data.value = loadUint(cell, t, data.len * 8);
    return data;
}

/**
 * Loads Grams  <br>
 * 
 * nanograms$_ amount:(VarUInteger 16) = Grams;  
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @returns {Object}
 */
function loadGrams(cell, t) {
    let data = {_:"Grams"};
    data.amount = loadVarUInteger(cell, t, 16);
    return data;
}


/**
 * Loads Ref  <br>
 * 
 * ^ X
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {Function} f Function to parse ref
 * @returns {Object}
 */
function loadRefIfExist(cell, t, f) {
    const r = cell.refs[t.ref++];
    // do not load prunned cell
    if (r.type !== Cell.PrunnedBranchCell && f) {
        return f(r, {cs:0, ref: 0});
    } else if (r.type === Cell.PrunnedBranchCell) {
        return r;
    }
}


/**
 * Loads Maybe  <br>
 * 
 * nothing$0 {X:Type} = Maybe X; <br>
 * just$1 {X:Type} value:X = Maybe X;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {Function} f Function to parse ref
 * @param {Object} extra Extra parameters to function
 * @returns {Object}
 */
function loadMaybe(cell, t, f, extra) {
    const exist = loadBit(cell, t);
    if (!exist || !f) {
        return;
    }
    if (extra)
        return f(cell, t, ...extra);
    else
        return f(cell, t);
}

/**
 * Loads Maybe with ref <br>
 * 
 * Maybe ^X
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {Function} f Function to parse ref
 * @param {Function} f2 Function to parse PrunnedBranchCell
 * @returns {Object}
 */
function loadMaybeRef(cell, t, f, f2) {
    const exist = loadBit(cell, t);
    if (!exist || !f) {
        return;
    }
    let c = cell.refs[t.ref++];
    if (c.type !== Cell.PrunnedBranchCell)
        return f(c, {cs:0, ref:0});
    else if (f2)
        f2(c, {cs:0, ref:0});
    else
        return c;
}

/**
 * Loads Either <br>
 * 
 * left$0 {X:Type} {Y:Type} value:X = Either X Y; <br>
 * right$1 {X:Type} {Y:Type} value:Y = Either X Y;
 * 
 * @throws {Error} Error object with description
 * @param {Cell} cell Cell object to parse
 * @param {Object} t Current position
 * @param {Function} fx Function to parse X
 * @param {Function} fy Function to parse Y
 * @returns {Object}
 */
function loadEither(cell, t, fx, fy) {
    const b = loadBit(cell, t);
    if (b === 0) {
        return fx(cell, t);
    }
    else {
        return fy(cell, t);
    }
}

module.exports = {
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
    loadBool,
    loadUintLeq,
    loadUintLess,
    loadVarUInteger,
    loadGrams,
    loadRefIfExist,
    loadMaybe,
    loadMaybeRef,
    loadEither
}