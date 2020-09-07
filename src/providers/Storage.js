const {BlockId} = require("../blockchain/BlockId");
const {crc16, bytesToHex} = require("../utils");

/**
 * TON Storage class
 */
class Storage {
    /**
     * Creates Storage class with specific zerohash
     * 
     * @param {string} zerohash 
     */
    constructor(zerohash) {
        this.zerohash = zerohash;
        this.knownBlocks = {};
        this.knownBlocksChanged = false;
        this.knownHosts = {};
        this.knownHostsChanged = false;
    }

    /**
     * Gets known blocks from storage
     * 
     * @returns {Object} Object with known block ids
     */
    getKnownBlocks() {
        return this.knownBlocks;
    }

    /**
     * Adds block id to known blocks
     * 
     * @param {BlockId} blockId 
     */
    addBlock(blockId) {
        this.knownBlocks[blockId.seqno] = blockId;
        this.knownBlocksChanged = true;
    }

    /**
     * Saves info
     */
    save() {
        this._save();
    }

    /**
     * Loads info
     */
    load() {
        this._load();
    }

    /**
     * Clears all info
     */
    clear() {
        this.knownBlocks = {};
        this.knownBlocksChanged = true;
        this.knownHosts = {};
        this.knownHostsChanged = true;
    }
}

/**
 * Browser specific implementation of Storage class
 */
class BrowserStorage extends Storage {
    constructor(zerohash) {
        super(zerohash);
    }
    
    /**
     * @private
     */
    _save() {
        if (this.knownBlocksChanged) {
            const k = "knownBlocks:" + this.zerohash;
            let s = '';
            for (let i in this.knownBlocks) {
                s += this.knownBlocks[i].toString() + ';';
            }
            let crc = bytesToHex(crc16(s));
            localStorage.setItem(k, crc + '|' + s);
            this.knownBlocksChanged = false;
        }
        if (this.knownHostsChanged) {
            // eslint-disable-next-line no-unused-vars
            const k = "knownHosts:" + this.zerohash;
            //localStorage.setItem(k, this.knownHosts);
            this.knownHostsChanged = false;
        }
    }

    /**
     * @private
     */
    _load() {
        this.knownBlocks = {};
        this.knownBlocksChanged = false;
        const k = "knownBlocks:" + this.zerohash;
        let blks = localStorage.getItem(k);
        if (!blks)
            return;
        let init = blks.split('|');
        if (init.length !== 2)
            return;
        let crc = bytesToHex(crc16(init[1]));
        if (crc !== init[0]) {
            console.warn('invalid hash in storage');
            return;
        }
        blks = init[1].split(';');
        for (let i = 0; i < blks.length; i++) {
            if (!blks[i].length)
                continue;
            try {
                const blk = new BlockId().fromString(blks[i]);
                this.knownBlocks[blk.seqno] = blk;
            } catch (e) {
                console.warn('Error loading block:', e);
            }
        }
    }
}


class DummyStorage extends Storage {
    constructor(zerohash) {
        super(zerohash);
    }
    
    /**
     * @private
     */
    _save() {}

    /**
     * @private
     */
    _load() {}
}


module.exports = {Storage, BrowserStorage, DummyStorage};