const {BlockId} = require("../blockchain/BlockId");


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
            localStorage.setItem(k, s);
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
        blks = blks.split(';');
        for (let i = 0; i < blks.length; i++) {
            if (!blks[i].length)
                continue;
            const blk = new BlockId().fromString(blks[i]);
            this.knownBlocks[blk.seqno] = blk;
        }
    }
}

module.exports = {Storage, BrowserStorage};