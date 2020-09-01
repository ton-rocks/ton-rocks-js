const {BN} = require("../utils");
const {Cell} = require("./Cell");
const {
    loadBit,
    loadUint,
    loadUintLeq,
    loadMaybeRef
} = require("../blockchain/BlockUtils");

/**
 * TON Hashmap class
 */
class Hashmap {

    /**
     * Creates empty hashmap with `n` bitwidth
     * 
     * @param {number} n Hash bitwidth
     * @param {function} f Function for leaf load
     */
    constructor(n, f) {
        this.map = new Map();
        this.prunned = [];
        this.n = n;
        this.f = f;
        this._ = "Hashmap";
    }

    /*
    Map key is {number | BN}
    */

    /*
    this.map.set(key, value)
    this.map.get(key)
    this.map.has(key)
    this.map.delete(key)
    this.map.clear()
    this.map.size
    */

    /**
     * @private
     * @param {string} key1 
     * @param {string} key2 
     */
    getLabel(key1, key2) {
        let i = 0;
        let result = "";

        while (i < key1.length && i < key2.length)
        {
            if (key1[i] === key2[i]) {
                result += key1[i];
                i++;
            }
            else
                break;
        }
        return result;
    }

    /**
     * @private
     * @param {Cell} cell 
     * @param {Object} t 
     */
    loadUnary(cell, t) {
        const type = loadBit(cell, t);
        if (type === 0) {
            // unary_zero
            return 0;
        } else {
            // unary_succ
            const x = this.loadUnary(cell, t);
            return x + 1;
        }
    }

    /**
     * @private
     * @param {Cell} cell 
     * @param {Object} t 
     * @param {number} m 
     */
    loadLabel(cell, t, m) {
        const type = loadBit(cell, t);
        if (type === 0) {
            // hml_short$0 {m:#} {n:#} len:(Unary ~n) s:(n * Bit) = HmLabel ~n m;
            const n = this.loadUnary(cell, t);
            if (n > 0) {
                const s = loadUint(cell, t, n);
                return [s, n];
            } else {
                return [new BN(0), n];
            }
        }
        else {
            const type2 = loadBit(cell, t);
            if (type2 === 0) {
                // hml_long$10 {m:#} n:(#<= m) s:(n * Bit) = HmLabel ~n m;
                const n = loadUintLeq(cell, t, m);
                const s = loadUint(cell, t, n);
                return [s, n];
            }
            else {
                // hml_same$11 {m:#} v:Bit n:(#<= m) = HmLabel ~n m;
                const v = loadBit(cell, t);
                const n = loadUintLeq(cell, t, m);
                let s = new BN(0);
                for (let i = 0; i < n; i++) {
                    s.ishln(1).ior(new BN(v));
                }
                return [s, n];
            }
        }
    }

    /**
     * @private
     * @param {Cell} cell 
     * @param {Object} t 
     * @param {number} n 
     * @param {BN} key 
     * @param {boolean} fork 
     */
    loadHashmap(cell, t, n, key, fork=false) {
        if (cell.type !== Cell.OrdinaryCell) {
            if (cell.type === Cell.PrunnedBranchCell) {
                this.prunned.push(key.toString(2, this.n));
            }
            return;
        }
        if (n === 0 && fork) {
            // hmn_leaf#_ {X:Type} value:X = HashmapNode 0 X;
            if (this.f) {
                const data = this.f(cell, t, key);
                if (data) {
                    //console.log('add to hashmap', key.toString(16), data);
                    this.map.set(key.toString(16), data);
                }
            }
            return;
        }
        if (fork) {
            // no data in cell
            // hmn_fork#_ {n:#} {X:Type} left:^(Hashmap n X) right:^(Hashmap n X) = HashmapNode (n + 1) X;
            const left = key.shln(1);
            this.loadHashmap(cell.refs[t.ref++], {cs:0, ref:0}, n-1, left, !fork);
            const right = key.shln(1).add(new BN(1));
            this.loadHashmap(cell.refs[t.ref++], {cs:0, ref:0}, n-1, right, !fork);
            return;
        } else {
            // got some data
            // hm_edge#_ {n:#} {X:Type} {l:#} {m:#} label:(HmLabel ~l n) {n = (~m) + l} node:(HashmapNode m X) = Hashmap n X;
            const label = this.loadLabel(cell, t, n);
            if (label[1] > 0) {
                const nextkey = key.shln(label[1]).or(label[0]);
                const m = n - label[1];
                this.loadHashmap(cell, t, m, nextkey, !fork);
            } else {
                this.loadHashmap(cell, t, n, key, !fork);
            }
            return;
        }
    }

    /**
     * Loads hashmap from cell tree
     * 
     * @throws {Error}
     * @param {Cell} cell Cell to load from 
     * @param {Object} t Position in cell
     */
    deserialize(cell, t) {
        this.loadHashmap(cell, t, this.n, new BN(0));
    }

    /**
     * Serializes Hashmap to Cell
     * 
     * @throws {Error}
     * @param {Cell} cell
     */
    serialize(cell) {
        if (this.size === 0) {
            throw Error("Hashmap cannot be empty");
        }

        let m = {};
        for (let k of this.keys()) {
            let kn = new BN(k);
            m[kn.toString(2, this.n)] = this.map.get(k);
        }

        this.serializeBitmap(cell, m, this.n);
    }

    /**
     * @private
     * @throws {Error}
     * @param {Cell} cell
     */
    serializeBitmap(cell, map, n) {
        if (map.size === 0) {
            throw "Hashmap cannot be empty";
        }

        let label = null;
        let one = null;
        for (let k in map) {
            if (label === null) {
                label = k;
                one = map[k];
            } else {
                label = this.getLabel(label, k);
            }
        }
        if (label.length === 0 || label === 'one') {
            if (n === 0) {
                // hmn_leaf#_ {X:Type} value:X = HashmapNode 0 X;
                const free = cell.bits.getFreeBits();
                const need = one.bits.getUsedBits();
                if (free < need) {
                    throw Error("Cannot fit data in Cell");
                }
                cell.writeCell(one);
                return;
            } else {
                // hmn_fork#_ {n:#} {X:Type} left:^(Hashmap n X)
                // right:^(Hashmap n X) = HashmapNode (n + 1) X;
                let left = {};
                let right = {};
                for (let k in map) {
                    if (k[0] === '0') {
                        left[k.slice(1)] = map[k];
                    } else {
                        right[k.slice(1)] = map[k];
                    }
                }

                let left_cell = new Cell();
                this.serializeBitmap(left_cell, left, n-1);
                cell.refs.push(left_cell);

                let right_cell = new Cell();
                this.serializeBitmap(right_cell, right, n-1);
                cell.refs.push(right_cell);

                return;
            }
        } else {
            // hm_edge#_ {n:#} {X:Type} {l:#} {m:#} label:(HmLabel ~l n)
            // {n = (~m) + l} node:(HashmapNode m X) = Hashmap n X;
            if (label.split("0").length - 1 === label.length || label.split("1").length - 1 === label.length) {
                // hml_same$11 {m:#} v:Bit n:(#<= m) = HmLabel ~n m;
                cell.bits.writeBit(1);
                cell.bits.writeBit(1);
                cell.bits.writeBit(label[0] === '1');
                const log_n = Math.ceil(Math.log2(n+1));
                cell.bits.writeUint(n, log_n);
            }
            else {
                // hml_long$10 {m:#} n:(#<= m) s:(n * Bit) = HmLabel ~n m;
                cell.bits.writeBit(1);
                cell.bits.writeBit(0);
                const log_n = Math.ceil(Math.log2(n+1));
                cell.bits.writeUint(n, log_n);
                const s = new BN(label, 2);
                cell.bits.writeUint(s, n);
            }
            // TODO
            // hml_short$0 {m:#} {n:#} len:(Unary ~n)
            // s:(n * Bit) = HmLabel ~n m;
            let next = {};
            if (label.length === n) {
                next['one'] = map[label];
            } else {
                for (let k in map) {
                    next[k.slice(label.length)] = map[k];
                }
            }
            this.serializeBitmap(cell, next, n-label.length);
            return;
        }
    }
}


/**
 * TON HashmapE class
 */
class HashmapE extends Hashmap {

    /**
     * Creates empty hashmap with `n` bitwidth
     * 
     * @param {number} n Hash bitwidth
     * @param {function} f Function for leaf load
     */
    constructor(n, f) {
        super(n, f);
        this._ = "HashmapE";
    }

    /**
     * Loads HashmapE from cell tree
     * 
     * @throws {Error}
     * @param {Cell} cell Cell to load from 
     * @param {Object} t Position in cell
     */
    deserialize(cell, t) {
        // eslint-disable-next-line no-unused-vars
        loadMaybeRef(cell, t, (c,p) => this.loadHashmap(c, p, this.n, new BN(0)), (c,p) => {this.hash = c.getHash(0);});
    }

    /**
     * Serializes HashmapE to Cell
     * 
     * @param {Cell} cell
     */
    serialize(cell) {
        if (this.size === 0) {
            // hme_empty$0 {n:#} {X:Type} = HashmapE n X;
            cell.bits.writeBit(0);
            return;
        }

        // hme_root$1 {n:#} {X:Type} root:^(Hashmap n X) = HashmapE n X;

        cell.bits.writeBit(1);

        let c = new Cell();
        super.serialize(c);
        cell.refs.push(c);
    }
}

/**
 * TON HashmapAug class
 */
class HashmapAug extends Hashmap {

    /**
     * Creates empty hashmap with `n` bitwidth
     * 
     * @param {number} n Hash bitwidth
     * @param {function} f Function for leaf load
     */
    constructor(n, f) {
        super(n, f);
        this._ = "HashmapAug";
    }
}

/**
 * TON HashmapAugE class
 */
class HashmapAugE extends HashmapE {

    /**
     * Creates empty hashmap with `n` bitwidth
     * 
     * @param {number} n Hash bitwidth
     * @param {function} f Function for leaf load
     */
    constructor(n, f) {
        super(n, f);
        this._ = "HashmapAugE";
    }
}

module.exports = {Hashmap, HashmapE, HashmapAug, HashmapAugE};