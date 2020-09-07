const {BN, compareBytes, bytesToBase64, base64ToBytes, concatBytes} = require("../utils");

/**
 * Block id class
 */
class BlockId {
    /**
     * Creates new BlockId object
     * 
     * @param {BlockId} o? Block id to copy from
     */
    constructor(o) {
        if (o && o.file_hash) {
            if (typeof o.file_hash === 'string')
                this.file_hash = new Uint32Array(base64ToBytes(o.file_hash).buffer);
            else
                this.file_hash = new Uint32Array(o.file_hash.buffer);
        } else {
            this.file_hash = new Uint32Array();
        }
        if (o && o.root_hash) {
            if (typeof o.root_hash === 'string')
                this.root_hash = new Uint32Array(base64ToBytes(o.root_hash).buffer);
            else
                this.root_hash = new Uint32Array(o.root_hash.buffer);
        } else {
            this.root_hash = new Uint32Array();
        }
        this.workchain = o ? o.workchain : 0;
        if (o && o.shard) {
            if (typeof o.shard === 'string')
                this.shard = new BN(o.shard, 16);
            else
                this.shard = o.shard.clone();
        } else {
            this.shard = new BN(0);
        }
        this.seqno = o && o.seqno ? o.seqno : 0;
    }

    /**
     * Clones BlockId object
     * 
     * @param {BlockId} b 
     * @returns {BlockId}
     */
    clone(b) {
        return new BlockId(b);
    }

    /**
     * Gets JSON string representation of BlockId
     * 
     * @returns {string}
     */
    toString() {
        const b = {
            file_hash: bytesToBase64(new Uint8Array(this.file_hash.buffer)),
            root_hash: bytesToBase64(new Uint8Array(this.root_hash.buffer)),
            seqno: this.seqno,
            shard: this.shard.toString(16),
            workchain: this.workchain
        };
        return JSON.stringify(b);
    }

    /**
     * Loads block id from JSON string
     * 
     * @param {string} s JSON representarion of BlockId 
     */
    fromString(s) {
        const o = JSON.parse(s);
        this.file_hash = new Uint32Array(base64ToBytes(o.file_hash).buffer);
        this.root_hash = new Uint32Array(base64ToBytes(o.root_hash).buffer);
        this.seqno = o['seqno'];
        this.shard = new BN(o['shard'], 16);
        this.workchain = o['workchain'];
        return this;
    }

    /**
     * Returns file hash in base64 format
     * 
     * @returns {string}
     */
    filehashBase64() {
        return bytesToBase64(new Uint8Array(this.file_hash.buffer));
    }

    /**
     * Returns root hash in base64 format
     * 
     * @returns {string}
     */
    roothashBase64() {
        return bytesToBase64(new Uint8Array(this.root_hash.buffer));
    }

    toLiteId() {
        const id = {
            file_hash: this.file_hash,
            root_hash: this.root_hash,
            workchain: this.workchain,
            shard: this.longFromBN(this.shard),
            seqno: this.seqno
        };
        return id;
    }

    fromLiteId(id) {
        this.file_hash = id.file_hash;
        this.root_hash = id.root_hash;
        this.seqno = id.seqno;
        this.shard = this.longToBN(id.shard);
        this.workchain = id.workchain;
        return this;
    }

    longFromBN(l) {
        let arr8 = new Uint8Array(l.toArray('le'));
        if (arr8.length < 8) {
            let append = new Uint8Array(8 - arr8.length);
            arr8 = concatBytes(arr8, append);
        }
        const arr32 = new Int32Array(arr8.buffer);
        return [arr32[0], arr32[1]];
    }

    longToBN(l) {
        let arr32 = new Int32Array(l);
        let arr8 = new Uint8Array(arr32.buffer);
        return new BN(arr8, 10, 'le');
    }

    /**
     * Compares two blockIds
     * 
     * @param {BlockId} a BlockId to compare with
     * @returns {boolean} True if same
     */
    compare(a) {
        if (!a) return false;
        if (a.seqno !== this.seqno ||
            a.workchain !== this.workchain ||
            !this.compareShard(a.shard) || 
            !compareBytes(new Uint8Array(a.file_hash.buffer), new Uint8Array(this.file_hash.buffer)) ||
            !compareBytes(new Uint8Array(a.root_hash.buffer), new Uint8Array(this.root_hash.buffer)))
            return false;
        return true;
    }

    /**
     * Compares two shards
     * 
     * @param {BN} a BlockId to compare with
     * @returns {boolean} True if same
     */
    compareShard(a) {
        if (!a) return false;
        return this.shard.cmp(a) === 0;
    }

    /**
     * Returns masterchain shard
     * 
     * @returns {BN}
     */
    static shardMasterchain()  {
        return new BN("8000000000000000", 16);
    }
}

module.exports = {BlockId};