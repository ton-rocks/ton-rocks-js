const {BitString} = require("../types/BitString");
const {Cell} = require("../types/Cell");
const {BN, compareBytes} = require("../utils");


function loadUint(cell, t, n) {
    if (t.cs + n > cell.bits.cursor)
        throw Error("cannot load uint");
    const i = cell.bits.readUint(t.cs, n); t.cs += n;
    return i;
}
function loadUint8(cell, t) {
    return loadUint(cell, t, 8).toNumber();
}
function loadUint16(cell, t) {
    return loadUint(cell, t, 16).toNumber();
}
function loadUint32(cell, t) {
    return loadUint(cell, t, 32).toNumber();
}
function loadUint64(cell, t) {
    return loadUint(cell, t, 64);
}

function loadInt8(cell, t) {
    if (t.cs + 8 > cell.bits.cursor)
        throw Error("cannot load int8");
    const i = cell.bits.readInt8(t.cs); t.cs += 8;
    return i;
}
function loadInt16(cell, t) {
    if (t.cs + 16 > cell.bits.cursor)
        throw Error("cannot load int16");
    const i = cell.bits.readInt16(t.cs); t.cs += 16;
    return i;
}
function loadInt32(cell, t) {
    if (t.cs + 32 > cell.bits.cursor)
        throw Error("cannot load int32");
    const i = cell.bits.readInt32(t.cs); t.cs += 32;
    return i;
}

function loadBit(cell, t) {
    if (t.cs + 1 > cell.bits.cursor)
        throw Error("cannot load bit");
    return cell.bits.get(t.cs++) ? 1 : 0;
}
function loadBits(cell, t, n) {
    if (t.cs + n > cell.bits.cursor)
        throw Error("cannot load bits");
    const bits = cell.bits.getRange(t.cs, n);
    t.cs += n;
    return bits;
}

function loadBool(cell, t) {
    if (t.cs + 1 > cell.bits.cursor)
        throw Error("cannot load Bool");
    return cell.bits.get(t.cs++) ? true : false;
}

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

function loadUintLess(cell, t, n) {
    return loadUintLeq(cell, t, n-1);
}

/*
var_uint$_ {n:#} len:(#< n) value:(uint (len * 8))
     = VarUInteger n;
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

/*
nanograms$_ amount:(VarUInteger 16) = Grams;  
*/
function loadGrams(cell, t) {
    let data = {_:"Grams"};
    data.amount = loadVarUInteger(cell, t, 16);
    return data;
}


/*
^ X
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


/*
nothing$0 {X:Type} = Maybe X;
just$1 {X:Type} value:X = Maybe X;
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

/*
Maybe ^X
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

/*
left$0 {X:Type} {Y:Type} value:X = Either X Y;
right$1 {X:Type} {Y:Type} value:Y = Either X Y;
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