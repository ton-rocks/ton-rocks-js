const {BitString} = require("./BitString");
const {bytesToBase64, compareBytes, concatBytes, crc32c, hexToBytes, bytesToHex, readNBytesUIntFromArray, sha256} = require("../utils");

const reachBocMagicPrefix = hexToBytes('B5EE9C72');
const leanBocMagicPrefix = hexToBytes('68ff65f3');
const leanBocMagicPrefixCRC = hexToBytes('acc3a728');

const hash_bytes = 32;
const depth_bytes = 2;


DEBUG = false;
function debug_log() {
    if ( DEBUG ) {
        console.log.apply(this, arguments);
    }
}

class Cell {

    constructor() {
        this._ = "Cell";
        this.bits = new BitString(1023);
        this.refs = [];
        this.isExotic = false;
        this.type = Cell.OrdinaryCell;
        this.hasHashes = false;
        this.levelMask = 0;
        this.hashes = [];
        this.depth = [];
    }

    getLevelFromMask(mask) {
        for (let i = 0; i <= 3; i++) {
            if (!mask) {
                return i;
            }
            mask = mask >> 1;
        }
        return 3;
    }

    getHashesCountFromMask(mask) {
        let n = 0;
        for (let i = 0; i < 3; i++) {
            n += (mask & 1);
            mask = mask >> 1;
        }
        return n+1; // 1 repr + up to 3 higher hashes
    }

    getLevel() {
        return this.getLevelFromMask(this.levelMask & 7);
    }

    getHashesCount() {
        return this.getHashesCountFromMask(this.levelMask & 7)
    }

    isLevelSignificant(level) {
        const res = level == 0 || ((this.levelMask >> (level - 1)) % 2 != 0);
        return res;
    }

    applyLevelMask(level) {
        return (this.levelMask & ((1 << level) - 1));
    }

    /**
     * @param serializedBOC  {string | UInt8Array}
     * @return {Cell}
     */
    static async fromBoc(serializedBoc) {
        return await deserializeBoc(serializedBoc);
    }

    /**
     * Write another cell to this cell
     * @param anotherCell  {Cell}
     */
    writeCell(anotherCell) {
        // XXX we do not check that there are anough place in cell
        this.bits.writeBitString(anotherCell.bits);
        this.refs = this.refs.concat(anotherCell.refs);
    }

    /**
     * @return {number}
     */
    getLevelMask() {
        //TODO level calculation differ for exotic cells
        if (this.isExotic && this.type != Cell.LibraryCell) {
            switch (this.type) {
                case Cell.PrunnedBranchCell:
                    // set it manually 
                    return this.levelMask;
                case Cell.MerkleProofCell:
                    this.levelMask = this.refs[0].getLevelMask() >> 1;
                    return this.levelMask;
                case Cell.MerkleUpdateCell:
                    this.levelMask = (this.refs[0].getLevelMask() | this.refs[1].getLevelMask()) >> 1;
                    return this.levelMask;
                default:
                    throw Error("Unknown special cell type");
            }
        } else {
            let levelMask = 0;
            for (let k in this.refs) {
                levelMask |= this.refs[k].getLevelMask();
            }
            this.levelMask = levelMask;
            return levelMask;
        }
    }

    /**
     * @return {number}
     */
    isExplicitlyStoredHashes() {
        return 0;
    }

    getHash(level=0) {
        let hash_i = this.getHashesCountFromMask(this.applyLevelMask(level)) - 1;
        if (this.type == Cell.PrunnedBranchCell) {
            const this_hash_i = this.getHashesCount() - 1;
            if (hash_i != this_hash_i) {
                return this.bits.getRange(16 + hash_i * hash_bytes * 8, 256);
            }
            hash_i = 0;
        }
        return this.hashes[hash_i];
    }

    /**
     * @return {number}
     */
    getDepth(level=0) {
        let hash_i = this.getHashesCountFromMask(this.applyLevelMask(level)) - 1;
        if (this.type == Cell.PrunnedBranchCell) {
            const this_hash_i = this.getHashesCount() - 1;
            if (hash_i != this_hash_i) {
                return this.bits.readUint16(16 + this_hash_i * hash_bytes * 8 + hash_i * depth_bytes * 8);
            }
            hash_i = 0;
        }
        return this.depth[hash_i];
    }

    /**
     * @private
     * @return {Uint8Array}
     */
    depthToArray(depth) {
        const d = Uint8Array.from({length: 2}, () => 0);
        d[1] = depth % 256;
        d[0] = Math.floor(depth / 256);
        return d;
    }

    /**
     * @return {Uint8Array}
     */
    getRefsDescriptor(levelMask) {
        levelMask = levelMask === undefined ? this.getLevelMask() : levelMask;
        const d1 = Uint8Array.from({length: 1}, () => 0);
        //d1[0] = this.refs.length + this.isExotic * 8 + this.hasHashes * 16 + levelMask * 32;
        // ton node variant used
        d1[0] = this.refs.length + this.isExotic * 8 + levelMask * 32;
        return d1;
    }

    /**
     * @return {Uint8Array}
     */
    getBitsDescriptor() {
        const d2 = Uint8Array.from({length: 1}, () => 0);
        d2[0] = Math.ceil(this.bits.cursor / 8) + Math.floor(this.bits.cursor / 8);
        return d2;
    }

    /**
     * @return {Uint8Array}
     */
    getDataWithDescriptors() {
        const d1 = this.getRefsDescriptor();
        const d2 = this.getBitsDescriptor();
        const tuBits = this.bits.getTopUppedArray();
        return concatBytes(concatBytes(d1, d2), tuBits);
    }

    /**
     * deprecated
     * @return {number}
     */
    getMaxDepth() {
        let maxDepth = 0;
        if (this.refs.length > 0) {
            for (let k in this.refs) {
                const i = this.refs[k];
                if (i.getMaxDepth() > maxDepth) {
                    maxDepth = i.getMaxDepth();
                }
            }
            maxDepth = maxDepth + 1;
        }
        return maxDepth;
    }

    /**
     * deprecated
     * @private
     * @return {Uint8Array}
     */
    getMaxDepthAsArray() {
        const maxDepth = this.getMaxDepth();
        const d = Uint8Array.from({length: 2}, () => 0);
        d[1] = maxDepth % 256;
        d[0] = Math.floor(maxDepth / 256);
        return d;
    }

    /**
     * deprecated
     * @return {Promise<Uint8Array>}
     */
    async getRepr() {
        const reprArray = [];

        reprArray.push(this.getDataWithDescriptors());
        for (let k in this.refs) {
            const i = this.refs[k];
            //if (i.depth.length > 0) {
            //    reprArray.push(i.depthToArray(i.getDepth()));
            //} else 
            {
                reprArray.push(i.getMaxDepthAsArray());
            }
        }
        debug_log('add to hash ' + this.refs.length + ' childs');
        for (let k in this.refs) {
            const i = this.refs[k];
            //if (i.hashes.length > 0) {
            //    const hash = i.getHash();
            //    debug_log('child hash ', bytesToHex(hash));
            //    reprArray.push(hash);
            //} else 
            {
                reprArray.push(await i.hash());
            }
        }
        let x = new Uint8Array();
        for (let k in reprArray) {
            const i = reprArray[k];
            x = concatBytes(x, i);
        }
        return x;
    }

    async finalize() {
        let type = Cell.OrdinaryCell;
        if (this.isExotic) {
            if (this.bits.length < 8) {
                throw Error("Not enough data for a special cell");
            }
            type = this.bits.readUint8(0);
            if (type == Cell.OrdinaryCell) {
                throw Error("Special cell has Ordinary type");
            }
        }

        this.type = type;

        switch (type) {
            case Cell.OrdinaryCell:
                for (let k in this.refs) {
                    this.levelMask |= this.refs[k].levelMask;
                }
            break;

            case Cell.PrunnedBranchCell:
                if (this.refs.length != 0) {
                    throw Error("PrunnedBranch special cell has a cell reference");
                }
                if (this.bits.length < 16) {
                    throw Error("Not enough data for a PrunnedBranch special cell");
                }
                this.levelMask = this.bits.readUint8(8);
                const level = this.getLevel();
                if (level > 3 || level == 0) {
                    throw Error("Prunned Branch has an invalid level");
                }
                const new_level_mask = this.applyLevelMask(level - 1);
                const hashes = this.getHashesCountFromMask(new_level_mask);
                if (this.bits.length != (2 + hashes * (hash_bytes + depth_bytes)) * 8) {
                    throw Error("Not enouch data for a PrunnedBranch special cell");
                }
            break;
        
            case Cell.LibraryCell:
                if (this.bits.length != 8 + hash_bytes * 8) {
                    throw Error("Not enouch data for a Library special cell");
                }
            break;

            case Cell.MerkleProofCell:
                if (this.bits.length != 8 + (hash_bytes + depth_bytes) * 8) {
                    throw Error("Not enouch data for a MerkleProof special cell");
                }
                if (this.refs.length != 1) {
                    throw Error("Wrong references count for a MerkleProof special cell");
                }
                const merkleHash = this.bits.getRange(8, hash_bytes * 8);
                const childHash = this.refs[0].getHash(0);
                if (!compareBytes(merkleHash, childHash)) {
                    throw Error("Hash mismatch in a MerkleProof special cell " + 
                        bytesToHex(merkleHash) + " != " + bytesToHex(childHash));
                }
                if (this.bits.readUint16(8 + hash_bytes * 8) != this.refs[0].getDepth(0)) {
                    throw Error("Depth mismatch in a MerkleProof special cell");
                }
                this.levelMask = this.refs[0].levelMask >> 1;
            break;
        
            case Cell.MerkleUpdateCell:
                if (this.bits.length != 8 + (hash_bytes + depth_bytes) * 8 * 2) {
                    throw Error("Not enouch data for a MerkleUpdate special cell");
                }
                if (this.refs.length != 2) {
                    throw Error("Wrong references count for a MerkleUpdate special cell");
                }
                const merkleHash0 = this.bits.getRange(8, hash_bytes * 8);
                const childHash0 = this.refs[0].getHash(0);
                if (!compareBytes(merkleHash0, childHash0)) {
                    throw Error("First hash mismatch in a MerkleUpdate special cell " + 
                        bytesToHex(merkleHash0) + " != " + bytesToHex(childHash0));
                }
                const merkleHash1 = this.bits.getRange(8 + hash_bytes * 8, hash_bytes * 8);
                const childHash1 = this.refs[1].getHash(0);
                if (!compareBytes(merkleHash1, childHash1)) {
                    throw Error("Second hash mismatch in a MerkleUpdate special cell " + 
                        bytesToHex(merkleHash1) + " != " + bytesToHex(childHash1));
                }
                if (this.bits.readUint16(8 + 16 * hash_bytes) != this.refs[0].getDepth(0)) {
                    throw Error("First depth mismatch in a MerkleUpdate special cell");
                }
                if (this.bits.readUint16(8 + 16 * hash_bytes + depth_bytes * 8) != this.refs[1].getDepth(0)) {
                    throw Error("Second depth mismatch in a MerkleUpdate special cell");
                }
                this.levelMask = (this.refs[0].levelMask | this.refs[1].levelMask) >> 1;
            break;
        
            default:
                throw Error("Unknown special cell type");
        }

        let total_hash_count = this.getHashesCount();
        let hash_count = type == Cell.PrunnedBranchCell ? 1 : total_hash_count;
        let hash_i_offset = total_hash_count - hash_count;

        //debug_log("calc type " + this.type + " hash level " + this.getLevel() + " hash cnt " + total_hash_count + " bitlength " + this.bits.cursor);

        this.hashes = [];
        this.depth = [];
        for (let i = 0; i < hash_count; i++) {
            this.hashes.push(null);
            this.depth.push(0);
        }

        for (let level_i = 0, hash_i = 0, level = this.getLevel(); level_i <= level; level_i++) {
            if (!this.isLevelSignificant(level_i)) {
                continue;
            }

            if (hash_i < hash_i_offset) {
                hash_i++;
                continue;
            }

            let repr = new Uint8Array();

            const new_level_mask = this.applyLevelMask(level_i);

            const d1 = this.getRefsDescriptor(new_level_mask);
            const d2 = this.getBitsDescriptor();
            repr = concatBytes(repr, d1);
            repr = concatBytes(repr, d2);

            //debug_log("add to hash d1 " + bytesToHex(d1) + " d2 " + bytesToHex(d2));

            if (hash_i == hash_i_offset) {
                //debug_log("add to hash data len", (this.bits.length + 7) >> 3);

                if (level_i != 0 && type != Cell.PrunnedBranchCell)
                    throw Error("Cannot deserialize cell");

                repr = concatBytes(repr, this.bits.getTopUppedArray());

            } else {
                //debug_log("add to hash own " + (hash_i - hash_i_offset - 1) + " hash", bytesToHex(this.hashes[hash_i - hash_i_offset - 1]));
      
                if (level_i == 0 || type == Cell.PrunnedBranchCell)
                    throw Error("Cannot deserialize cell");

                repr = concatBytes(repr, this.hashes[hash_i - hash_i_offset - 1]);
            }
            //if (type == Cell.MerkleProofCell || type == Cell.PrunnedBranchCell)
            //    debug_log(" contains", bytesToHex(this.bits.getTopUppedArray()));
    

            let dest_i = hash_i - hash_i_offset;

            let depth = 0;
            for (let k in this.refs) {
                const i = this.refs[k];
                let child_depth = 0;
                if (type == Cell.MerkleProofCell || type == Cell.MerkleUpdateCell) {
                    child_depth = i.getDepth(level_i + 1);
                } else {
                    child_depth = i.getDepth(level_i);
                }
                repr = concatBytes(repr, i.depthToArray(child_depth));
                depth = Math.max(depth, child_depth);
            }
            if (this.refs.length != 0) {
                if (depth >= 1024) {
                    throw Error("Depth is too big");
                }
                depth++;
            }
            this.depth[dest_i] = depth;

            //debug_log("add to hash " + this.refs.length + " childs");
            // children hash
            for (let i = 0; i < this.refs.length; i++) {
              if (type == Cell.MerkleProofCell || type == Cell.MerkleUpdateCell) {
                //debug_log("child type " + type + " lvl " + (level_i + 1) + " hash", bytesToHex(this.refs[i].getHash(level_i + 1)));
                repr = concatBytes(repr, this.refs[i].getHash(level_i + 1));
              } else {
                //debug_log("child lvl " + level_i + "hash", bytesToHex(this.refs[i].getHash(level_i)));
                repr = concatBytes(repr, this.refs[i].getHash(level_i));
              }
            }

            this.hashes[dest_i] = new Uint8Array(await sha256(repr));
            //debug_log("cell type " + this.type + " dest " + dest_i + " hash", bytesToHex(this.hashes[dest_i]));
            
            hash_i++;
        }
        //debug_log("cell hashes", total_hash_count);
        //for (let i = 0; i < total_hash_count; i++) {
        //    debug_log("- %s\n", bytesToHex(this.getHash(i)));
        //}
    }


    /**
     * deprecated
     * @return {Promise<Uint8Array>}
     */
    async hash() {
        return new Uint8Array(
            await sha256(await this.getRepr())
        );
    }

    async finalizeTree() {
        for (let k in this.refs) {
            await this.refs[k].finalizeTree();
        }
        await this.finalize();
    }

    /**
     * @return {{}}
     */
    toObject() {
        const res = {};
        res['data'] = {
            'b64': bytesToBase64(this.bits.array.slice(0, Math.ceil(this.bits.cursor / 8))),
            'len': this.bits.cursor
        };
        res['refs'] = []
        for (let k in this.refs) {
            const i = this.refs[k];
            res['refs'].push(i.toObject());
        }
        return res;
    }

    /**
     * Recursively prints cell's content like Fift
     * @return  {string}
     */
    print(indent) {
        indent = indent || '';
        let s = indent + 'x{' + this.bits.toHex() + '}\n';
        for (let k in this.refs) {
            const i = this.refs[k];
            s += i.print(indent + ' ');
        }
        return s;
    }

    //serialized_boc#b5ee9c72 has_idx:(## 1) has_crc32c:(## 1)
    //  has_cache_bits:(## 1) flags:(## 2) { flags = 0 }
    //  size:(## 3) { size <= 4 }
    //  off_bytes:(## 8) { off_bytes <= 8 }
    //  cells:(##(size * 8))
    //  roots:(##(size * 8)) { roots >= 1 }
    //  absent:(##(size * 8)) { roots + absent <= cells }
    //  tot_cells_size:(##(off_bytes * 8))
    //  root_list:(roots * ##(size * 8))
    //  index:has_idx?(cells * ##(off_bytes * 8))
    //  cell_data:(tot_cells_size * [ uint8 ])
    //  crc32c:has_crc32c?uint32
    // = BagOfCells;
    /**
     * create boc bytearray
     * @param has_idx? {boolean}
     * @param hash_crc32?  {boolean}
     * @param has_cache_bits?  {boolean}
     * @param flags? {number}
     * @return {Promise<Uint8Array>}
     */
    async toBoc(has_idx = true, hash_crc32 = true, has_cache_bits = false, flags = 0) {
        const root_cell = this;

        const allcells = root_cell.treeWalk();
        const topologicalOrder = allcells[1];
        const cellsIndex = allcells[2];

        let maxIndex = topologicalOrder.length;
        while (true) {
            let changed = false;
            for (let hash in cellsIndex) {
                let cell = cellsIndex[hash];
                let cellIndex = cell[0];
                let childHashList = cell[2];
                for (let child in childHashList) {
                    if (cellsIndex[childHashList[child]][0] <= cellIndex) {
                        cellsIndex[childHashList[child]][0] = maxIndex;
                        maxIndex++;
                        changed = true;
                    }
                }
            }
            if (!changed)
                break;
        }
        topologicalOrder.sort((a,b) => { return cellsIndex[a[0]][0]-cellsIndex[b[0]][0]; });
        let i = 0;
        for (let i = 0; i < topologicalOrder.length; i++) {
            cellsIndex[topologicalOrder[i][0]] = i;
        }

        const cells_num = topologicalOrder.length;
        const s = cells_num.toString(2).length; // Minimal number of bits to represent reference (unused?)
        const s_bytes = Math.min(Math.ceil(s / 8), 1);
        let full_size = 0;
        let sizeIndex = [];
        for (let cell_info of topologicalOrder) {
            full_size = full_size + cell_info[1].bocSerializationSize(cellsIndex, s_bytes);
            sizeIndex.push(full_size);
        }
        const offset_bits = full_size.toString(2).length; // Minimal number of bits to offset/len (unused?)
        const offset_bytes = Math.max(Math.ceil(offset_bits / 8), 1);

        const serialization = new BitString((1023 + 32 * 4 + 32 * 3) * topologicalOrder.length);
        serialization.writeBytes(reachBocMagicPrefix);
        serialization.writeBitArray([has_idx, hash_crc32, has_cache_bits]);
        serialization.writeUint(flags, 2);
        serialization.writeUint(s_bytes, 3);
        serialization.writeUint8(offset_bytes);
        serialization.writeUint(cells_num, s_bytes * 8);
        serialization.writeUint(1, s_bytes * 8); // One root for now
        serialization.writeUint(0, s_bytes * 8); // Complete BOCs only
        serialization.writeUint(full_size, offset_bytes * 8);
        serialization.writeUint(0, s_bytes * 8); // Root shoulh have index 0
        if (has_idx) {
            topologicalOrder.forEach(
                (cell_data, index) =>
                    serialization.writeUint(sizeIndex[index], offset_bytes * 8));
        }
        for (let cell_info of topologicalOrder) {
            const refcell_ser = cell_info[1].serializeForBoc(cellsIndex, s_bytes);
            serialization.writeBytes(refcell_ser);
        }
        let ser_arr = serialization.getTopUppedArray();
        if (hash_crc32) {
            ser_arr = concatBytes(ser_arr, crc32c(ser_arr));
        }

        return ser_arr;
    }

    /**
     * @private
     * @param cellsIndex
     * @param refSize
     * @return {Promise<Uint8Array>}
     */
    serializeForBoc(cellsIndex, refSize) {
        const reprArray = [];

        reprArray.push(this.getDataWithDescriptors());
        if (this.isExplicitlyStoredHashes()) {
            throw new Error("Cell hashes explicit storing is not implemented");
        }
        for (let k in this.refs) {
            const i = this.refs[k];
            const refHash = i.getHash(0);
            const refIndexInt = cellsIndex[refHash];
            let refIndexHex = refIndexInt.toString(16);
            if (refIndexHex.length % 2) {
                refIndexHex = "0" + refIndexHex;
            }
            const reference = hexToBytes(refIndexHex);
            reprArray.push(reference);
        }
        let x = new Uint8Array();
        for (let k in reprArray) {
            const i = reprArray[k];
            x = concatBytes(x, i);
        }
        return x;
    }

    /**
     * @private
     * @param cellsIndex
     * @param refSize
     * @return {Promise<number>}
     */
    bocSerializationSize(cellsIndex, refSize) {
        return this.serializeForBoc(cellsIndex, refSize).length;
    }

    /**
     * @private
     * @return {[[], {}]} topologicalOrderArray and indexHashmap
     */
    treeWalk() {
        return treeWalk(this, [], {});
    }
}

Cell.OrdinaryCell = 255;
Cell.PrunnedBranchCell = 1;
Cell.LibraryCell = 2;
Cell.MerkleProofCell = 3;
Cell.MerkleUpdateCell = 4;

/**
 * @param cell  {Cell}
 * @param topologicalOrderArray array of pairs: cellHash: Uint8Array, cell: Cell, ...
 * @param indexHashmap cellHash: Uint8Array -> cellIndex: number
 * @return {[[], {}]} topologicalOrderArray and indexHashmap
 */
function treeWalk(cell, topologicalOrderArray, indexHashmap) {
    const cellHash = cell.getHash(0);
    if (cellHash in indexHashmap) { // Duplication cell
        return [cellHash, topologicalOrderArray, indexHashmap];
    }
    const cellIndex = topologicalOrderArray.length;
    topologicalOrderArray.push([cellHash, cell]);
    let childHashList = [];
    for (let subCell of cell.refs) {
        const res = treeWalk(subCell, topologicalOrderArray, indexHashmap);
        childHashList.push(res[0]);
        topologicalOrderArray = res[1];
        indexHashmap = res[2];
    }
    indexHashmap[cellHash] = [cellIndex, cell, childHashList];
    return [cellHash, topologicalOrderArray, indexHashmap];
}


function parseBocHeader(serializedBoc) {
    // snake_case is used to match TON docs
    if (serializedBoc.length < 4 + 1)
        throw Error("Not enough bytes for magic prefix");
    const inputData = serializedBoc; // Save copy for crc32
    const prefix = serializedBoc.slice(0, 4);
    serializedBoc = serializedBoc.slice(4);
    let has_idx, hash_crc32, has_cache_bits, flags, size_bytes;
    if (compareBytes(prefix, reachBocMagicPrefix)) {
        const flags_byte = serializedBoc[0];
        has_idx = flags_byte & 128;
        hash_crc32 = flags_byte & 64;
        has_cache_bits = flags_byte & 32;
        flags = (flags_byte & 16) * 2 + (flags_byte & 8);
        size_bytes = flags_byte % 8;
    }
    if (compareBytes(prefix, leanBocMagicPrefix)) {
        has_idx = 1;
        hash_crc32 = 0;
        has_cache_bits = 0;
        flags = 0;
        size_bytes = serializedBoc[0];
    }
    if (compareBytes(prefix, leanBocMagicPrefixCRC)) {
        has_idx = 1;
        hash_crc32 = 1;
        has_cache_bits = 0;
        flags = 0;
        size_bytes = serializedBoc[0];
    }
    serializedBoc = serializedBoc.slice(1);
    if (serializedBoc.length < 1 + 5 * size_bytes)
        throw Error("Not enough bytes for encoding cells counters");
    const offset_bytes = serializedBoc[0];
    serializedBoc = serializedBoc.slice(1);
    const cells_num = readNBytesUIntFromArray(size_bytes, serializedBoc);
    serializedBoc = serializedBoc.slice(size_bytes);
    const roots_num = readNBytesUIntFromArray(size_bytes, serializedBoc);
    serializedBoc = serializedBoc.slice(size_bytes);
    const absent_num = readNBytesUIntFromArray(size_bytes, serializedBoc);
    serializedBoc = serializedBoc.slice(size_bytes);
    const tot_cells_size = readNBytesUIntFromArray(offset_bytes, serializedBoc);
    serializedBoc = serializedBoc.slice(offset_bytes);
    if (serializedBoc.length < roots_num * size_bytes)
        throw Error("Not enough bytes for encoding root cells hashes");
    let root_list = [];
    for (let c = 0; c < roots_num; c++) {
        root_list.push(readNBytesUIntFromArray(size_bytes, serializedBoc));
        serializedBoc = serializedBoc.slice(size_bytes);
    }
    let index = false;
    if (has_idx) {
        index = [];
        if (serializedBoc.length < offset_bytes * cells_num)
            throw Error("Not enough bytes for index encoding");
        for (let c = 0; c < cells_num; c++) {
            index.push(readNBytesUIntFromArray(offset_bytes, serializedBoc));
            serializedBoc = serializedBoc.slice(offset_bytes);
        }
    }

    if (serializedBoc.length < tot_cells_size)
        throw Error("Not enough bytes for cells data");
    const cells_data = serializedBoc.slice(0, tot_cells_size);
    serializedBoc = serializedBoc.slice(tot_cells_size);
    if (hash_crc32) {
        if (serializedBoc.length < 4)
            throw Error("Not enough bytes for crc32c hashsum");
        const length = inputData.length;
        if (!compareBytes(crc32c(inputData.slice(0, length - 4)), serializedBoc.slice(0, 4)))
            throw Error("Crc32c hashsum mismatch");
        serializedBoc = serializedBoc.slice(4);
    }
    if (serializedBoc.length)
        throw Error("Too much bytes in BoC serialization");
    return {
        has_idx: has_idx, hash_crc32: hash_crc32, has_cache_bits: has_cache_bits, flags: flags, size_bytes: size_bytes,
        off_bytes: offset_bytes, cells_num: cells_num, roots_num: roots_num, absent_num: absent_num,
        tot_cells_size: tot_cells_size, root_list: root_list, index: index,
        cells_data: cells_data
    };
}

function deserializeCellData(cellData, referenceIndexSize) {
    if (cellData.length < 2)
        throw Error("Not enough bytes to encode cell descriptors");

    const d1 = cellData[0], d2 = cellData[1];
    cellData = cellData.slice(2);

    const refNum = d1 & 7;

    if (refNum > 4) {
        throw Error("Cannot deserialize absent cell");
    }

    const dataByteSize = (d2 >> 1) + (d2 & 1);
    const fullfilledBytes = (d2 & 1) == 0;

    let cell = new Cell();

    cell.levelMask = d1 >> 5;
    cell.isExotic = (d1 & 8) != 0;
    cell.hasHashes = (d1 & 16) != 0;

    const hashesSize = cell.hasHashes ? cell.getHashesCount() * hash_bytes : 0;
    const depthSize = cell.hasHashes ? cell.getHashesCount() * 2 : 0;

    if (cellData.length < hashesSize + depthSize + dataByteSize + referenceIndexSize * refNum)
        throw Error("Not enough bytes to encode cell data");

    // skip hashes & depth
    cellData = cellData.slice(hashesSize);
    cellData = cellData.slice(depthSize);

    // load data
    cell.bits.setTopUppedArray(cellData.slice(0, dataByteSize), fullfilledBytes);
    cellData = cellData.slice(dataByteSize);

    // load refs
    for (let r = 0; r < refNum; r++) {
        cell.refs.push(readNBytesUIntFromArray(referenceIndexSize, cellData));
        cellData = cellData.slice(referenceIndexSize);
    }

    debug_log("exo", cell.isExotic, "l", cell.levelMask, 't', cell.bits.readUint8(0), "hasH", cell.hasHashes, "size", dataByteSize, "refs", refNum, "bitlength", cell.bits.cursor);
    return {cell: cell, residue: cellData};
}


/**
 * @param serializedBOC  {string | UInt8Array}
 * @return {Cell}
 */
async function deserializeBoc(serializedBoc) {
    if (typeof (serializedBoc) == 'string') {
        serializedBoc = hexToBytes(serializedBoc);
    }
    const header = parseBocHeader(serializedBoc);
    let cells_data = header.cells_data;
    let cells_array = [];
    for (let ci = 0; ci < header.cells_num; ci++) {
        let dd = deserializeCellData(cells_data, header.size_bytes);
        cells_data = dd.residue;
        cells_array.push(dd.cell);
    }
    for (let ci = header.cells_num - 1; ci >= 0; ci--) {
        let c = cells_array[ci];
        for (let ri = 0; ri < c.refs.length; ri++) {
            const r = c.refs[ri];
            if (r < ci) {
                throw Error("Topological order is broken");
            }
            c.refs[ri] = cells_array[r];
        }
        await c.finalize();
    }
    let root_cells = [];
    for (let ri of header.root_list) {
        root_cells.push(cells_array[ri]);
    }
    return root_cells;
}

module.exports = {Cell};