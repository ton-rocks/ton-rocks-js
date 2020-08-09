const {BlockId} = require("../blockchain/BlockId");
const {crc16, bytesToHex} = require("../utils");


class Storage {
    constructor(zerohash) {
        this.zerohash = zerohash;
        this.knownBlocks = {};
        this.knownBlocksChanged = false;
        this.knownHosts = {};
        this.knownHostsChanged = false;
    }

    getKnownBlocks() {
        return this.knownBlocks;
    }

    addBlock(blockId) {
        this.knownBlocks[blockId.seqno] = blockId;
        this.knownBlocksChanged = true;
    }

    save() {
        this._save();
    }

    load() {
        this._load();
    }

    clear() {
        this.knownBlocks = {};
        this.knownBlocksChanged = true;
        this.knownHosts = {};
        this.knownHostsChanged = true;
    }
}

class BrowserStorage extends Storage {
    constructor(zerohash) {
        super(zerohash);
    }
    
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
            const k = "knownHosts:" + this.zerohash;
            //localStorage.setItem(k, this.knownHosts);
            this.knownHostsChanged = false;
        }
    }

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
            } catch (e) {}
        }
    }
}

module.exports = {Storage, BrowserStorage};