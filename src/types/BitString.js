const {BN, bytesToHex} = require("../utils");

class BitString {
    /**
     * @param {number} length Length of BitString in bits
     */
    constructor(length) {
        this.array = Uint8Array.from({length: Math.ceil(length / 8)}, () => 0);
        this.cursor = 0;
        this.length = length;
    }

    /**
     * @return {number}
     */
    getFreeBits() {
        return this.length - this.cursor;
    }

    /**
     * @return {number}
     */
    getUsedBits() {
        return this.cursor;
    }

    /**
     * @return {number}
     */
    getUsedBytes() {
        return Math.ceil(this.cursor / 8);
    }

    /**
     * Gets n-th bit
     * 
     * @param {number} n
     * @return {boolean} Bit value at position `n`
     */
    get(n) {
        return (this.array[(n / 8) | 0] & (1 << (7 - (n % 8)))) > 0;
    }

    /**
     * Gets `n` length bit range from `start` position
     * 
     * @param {number} start Start position
     * @param {number} n
     * @return {Uint8Array} [start:start+n] bits
     */
    getRange(start, n) {
        let array = Uint8Array.from({length: Math.ceil(n / 8)}, () => 0);
        let cursor = 0;
        for (let x = start; x < start+n; x++) {
            let b = this.get(x);
            if (b && b > 0) {
                array[(cursor / 8) | 0] |= 1 << (7 - (cursor % 8));
            } else {
                array[(cursor / 8) | 0] &= ~(1 << (7 - (cursor % 8)));
            }
            cursor = cursor + 1;
        }
        return array;
    }

    /**
     * Reads unsigned int
     * 
     * @param {number} start Start position
     * @param {number} bitLength Size of uint in bits
     * @returns {BN} number
     */
    readUint(start, bitLength) {
        if (bitLength < 1) {
            throw "Incorrect bitLength";
        }
        let s = "";
        for (let i = start; i < start+bitLength; i++) {
            let b = this.get(i);
            if (b && b > 0) {
                s += '1';
            } else {
                s += '0';
            }
        }
        return new BN(s, 2);
    }

    /**
     * Reads Uint8
     * 
     * @param {number} start Start position
     * @returns {number}
     */
    readUint8(start) {
        return this.readUint(start, 8).toNumber();
    }

    /**
     * Reads Uint16
     * 
     * @param {number} start Start position
     * @returns {number}
     */
    readUint16(start) {
        return this.readUint(start, 16).toNumber();
    }

    /**
     * Reads Uint32
     * 
     * @param {number} start Start position
     * @returns {number}
     */
    readUint32(start) {
        return this.readUint(start, 32).toNumber();
    }

    /**
     * Reads Uint64
     * 
     * @param {number} start Start position
     * @returns {BN}
     */
    readUint64(start) {
        return this.readUint(start, 64);
    }

    /**
     * Reads Int8
     * 
     * @param {number} start Start position
     * @returns {number}
     */
    readInt8(start) {
        let data = this.getRange(start, 8);
        var dataView = new DataView(data.buffer);
        return dataView.getInt8(0);
    }

    /**
     * Reads Int16
     * 
     * @param {number} start Start position
     * @returns {number}
     */
    readInt16(start) {
        let data = this.getRange(start, 16);
        var dataView = new DataView(data.buffer);
        return dataView.getInt16(0, false);
    }

    /**
     * Reads Int32
     * 
     * @param {number} start Start position
     * @returns {number}
     */
    readInt32(start) {
        let data = this.getRange(start, 32);
        var dataView = new DataView(data.buffer);
        return dataView.getInt32(0, false);
    }

    /**
     * @private
     * @param {number} n
     */
    checkRange(n) {
        if (n > this.length) {
            throw Error("BitString overflow");
        }
    }

    /**
     * Sets bit value to 1 at position `n`
     * 
     * @param {number} n
     */
    on(n) {
        this.checkRange(n);
        this.array[(n / 8) | 0] |= 1 << (7 - (n % 8));
    }

    /**
     * Sets bit value to 0 at position `n`
     * 
     * @param {number} n
     */
    off(n) {
        this.checkRange(n);
        this.array[(n / 8) | 0] &= ~(1 << (7 - (n % 8)));
    }

    /**
     * Toggles bit value at position `n`
     * 
     * @param {number} n
     */
    toggle(n) {
        this.checkRange(n);
        this.array[(n / 8) | 0] ^= 1 << (7 - (n % 8));
    }

    /**
     * forEach every bit
     * 
     * @param {function(boolean): void} callback
     */
    forEach(callback) {
        const max = this.cursor;
        for (let x = 0; x < max; x++) {
            callback(this.get(x));
        }
    }

    /**
     * Writes bit and increase cursor
     * 
     * @param {boolean | number} b
     */
    writeBit(b) {
        if (b && b > 0) {
            this.on(this.cursor);
        } else {
            this.off(this.cursor);
        }
        this.cursor = this.cursor + 1;
    }

    /**
     * Writes bit array
     * 
     * @param {Array<boolean | number>} ba
     */
    writeBitArray(ba) {
        for (let i = 0; i < ba.length; i++) {
            this.writeBit(ba[i]);
        }
    }

    /**
     * Writes unsigned int
     * 
     * @param {number | BN} number Number to write
     * @param {number} bitLength Size of uint in bits
     */
    writeUint(number, bitLength) {
        number = new BN(number);
        if (
            bitLength == 0 ||
            (number.toString(2).length > bitLength)
        ) {
            if (number == 0) return;
            throw Error("bitLength is too small for number, got number=" + number + ",bitLength=" + bitLength);
        }
        const s = number.toString(2, bitLength);
        for (let i = 0; i < bitLength; i++) {
            this.writeBit(s[i] == 1);
        }
    }

    /**
     * Writes signed int
     * 
     * @param {number | BN} number Number to write
     * @param {number} bitLength Size of int in bits
     */
    writeInt(number, bitLength) {
        number = new BN(number);
        if (bitLength == 1) {
            if (number == -1) {
                this.writeBit(true);
                return;
            }
            if (number == 0) {
                this.writeBit(false);
                return;
            }
            throw Error("Bitlength is too small for number");
        } else {
            if (number.isNeg()) {
                this.writeBit(true);
                const b = new BN(2);
                const nb = b.pow(new BN(bitLength - 1));
                this.writeUint(nb.add(number), bitLength - 1);
            } else {
                this.writeBit(false);
                this.writeUint(number, bitLength - 1);
            }
        }
    }

    /**
     * Writes unsigned 8-bit int
     * 
     * @param {number} ui8 Number to write
     */
    writeUint8(ui8) {
        this.writeUint(ui8, 8);
    }

    /**
     * Writes array of unsigned 8-bit ints
     * 
     * @param {Uint8Array} ui8 Array to write
     */
    writeBytes(ui8) {
        for (let i = 0; i < ui8.length; i++) {
            this.writeUint8(ui8[i]);
        }
    }

    /**
     * Writes string
     * 
     * @param {string} s String to write
     */
    writeString(s) {
        for (let i = 0; i < s.length; i++) {
            this.writeUint8(s.charCodeAt(i));
        }
    }

    /**
     * Writes grams value 
     * 
     * @param {number | BN} amount Amount in nanograms
     */
    writeGrams(amount) {
        if (amount == 0) {
            this.writeUint(0, 4);
        } else {
            amount = new BN(amount);
            const l = Math.ceil((amount.toString(16).length) / 2);
            this.writeUint(l, 4);
            this.writeUint(amount, l * 8);
        }
    }

    /**
     * Writes TON address  <br>
     * 
     * addr_none$00 = MsgAddressExt; <br>
     * addr_std$10 anycast:(Maybe Anycast) <br>
     * workchain_id:int8 address:uint256 = MsgAddressInt; <br>
     * 
     * @param {Address | null} address Address to write
     */
    writeAddress(address) {
        if (address == null) {
            this.writeUint(0, 2);
        } else {
            this.writeUint(2, 2);
            this.writeUint(0, 1); // TODO split addresses (anycast)
            this.writeInt(address.wc, 8);
            this.writeBytes(address.hashPart);
        }
    }

    /**
     * Writes another BitString to this BitString
     * 
     * @param {BitString} anotherBitString
     */
    writeBitString(anotherBitString) {
        anotherBitString.forEach(x => {
            this.writeBit(x);
        });
    }

    /**
     * Clones this bitstring to new
     * 
     * @returns {BitString}
     */
    clone() {
        const result = new BitString(0);
        result.array = this.array.slice(0);
        result.length = this.length
        result.cursor = this.cursor;
        return result;
    }

    /**
     * Gets string hex representation of bit string
     * 
     * @return {string} hex
     */
    toString() {
        return this.toHex();
    }

    /**
     * Gets Top Upped Array (see TON docs)
     * 
     * @return {Uint8Array}
     */
    getTopUppedArray() {
        const ret = this.clone();

        let tu = Math.ceil(ret.cursor / 8) * 8 - ret.cursor;
        if (tu > 0) {
            tu = tu - 1;
            ret.writeBit(true);
            while (tu > 0) {
                tu = tu - 1;
                ret.writeBit(false);
            }
        }
        ret.array = ret.array.slice(0, Math.ceil(ret.cursor / 8));
        return ret.array;
    }

    /**
     * Gets hex representation of bit string
     * 
     * @return {string} hex
     */
    toHex() {
        if (this.cursor % 4 === 0) {
            const s = bytesToHex(this.array.slice(0, Math.ceil(this.cursor / 8))).toUpperCase();
            if (this.cursor % 8 === 0) {
                return s;
            } else {
                return s.substr(0, s.length - 1);
            }
        } else {
            const temp = this.clone();
            temp.writeBit(1);
            while (temp.cursor % 4 !== 0) {
                temp.writeBit(0);
            }
            const hex = temp.toHex().toUpperCase();
            return hex + '_';
        }
    }

    /**
     * Sets this cell data to match provided topUppedArray
     * 
     * @param {Uint8Array} array Array to copy from
     * @param {boolean} fullfilledBytes Is bytes in array fullfiled
     */
    setTopUppedArray(array, fullfilledBytes = true) {
        this.length = array.length * 8;
        this.array = array;
        this.cursor = this.length;
        if (fullfilledBytes || !this.length) {
            return;
        } else {
            let foundEndBit = false;
            for (let c = 0; c < 7; c++) {
                this.cursor -= 1;
                if (this.get(this.cursor)) {
                    foundEndBit = true;
                    this.off(this.cursor);
                    break;
                }
            }
            if (!foundEndBit) {
                console.log(array, fullfilledBytes);
                throw new Error("Incorrect TopUppedArray");
            }
        }
    }
}

module.exports = {BitString};