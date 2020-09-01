const BN = require("bn.js");
const nacl = require("tweetnacl");
const ethunit = require("ethjs-unit");
const bip39 = require("bip39");

let nodeCrypto = null;
if (typeof window === 'undefined') {
    nodeCrypto = require('crypto');
}

/**
 * Converts bytes to binary string
 * 
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
const bytesToBinString = (bytes) => bytes.reduce((str, byte) => str + byte.toString(2).padStart(8, '0'), '');

/**
 * Converts string to Uint8Array
 * 
 * @param {string} str 
 * @returns {Uint8Array}
 */
function stringToArray(str) {
    let buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        buf[i] = str.charCodeAt(i);
    }
    return buf;
}

/**
 * Converts bytes to string
 * 
 * @param {Uint8Array} b 
 * @returns {string}
 */
function bytesToString(b) {
    // convert bytes to string
    // encoding can be specfied, defaults to utf-8 which is ascii.
    return new TextDecoder().decode(b); 
}

/**
 * Calculates SHA256 hashsum
 * 
 * @param {Uint8Array} bytes
 * @returns {Promise<ArrayBuffer>}
 */
function sha256(bytes) {
    if (typeof window === 'undefined') {
        return nodeCrypto.createHash('sha256').update(bytes).digest();
    } else {
        return crypto.subtle.digest("SHA-256", bytes);
    }
}

/**
 * Calculates SHA512 hashsum
 * 
 * @param {Uint8Array} bytes
 * @returns {Promise<ArrayBuffer>}
 */
function sha512(bytes) {
    if (typeof window === 'undefined') {
        return nodeCrypto.createHash('sha512').update(bytes).digest();
    } else {
        return crypto.subtle.digest("SHA-512", bytes);
    }
}

/**
 * From grams to nanograms
 * 
 * @param {number | BN | string} amount
 * @returns {BN}
 */
function toNano(amount) {
    return ethunit.toWei(amount, 'gwei');
}

/**
 * From nanograms to grams
 * 
 * @param {number | BN | string} amount
 * @returns {string}
 */
function fromNano(amount) {
    return ethunit.fromWei(amount, 'gwei');
}

// look up tables
const to_hex_array = [];
const to_byte_map = {};
for (let ord = 0; ord <= 0xff; ord++) {
    let s = ord.toString(16);
    if (s.length < 2) {
        s = "0" + s;
    }
    to_hex_array.push(s);
    to_byte_map[s] = ord;
}

//  converter using lookups
/**
 * Converts bytes to hex string
 * 
 * @param {Uint8Array} buffer
 * @returns {string}
 */
function bytesToHex(buffer) {
    const hex_array = [];
    //(new Uint8Array(buffer)).forEach((v) => { hex_array.push(to_hex_array[v]) });
    for (let i = 0; i < buffer.byteLength; i++) {
        hex_array.push(to_hex_array[buffer[i]]);
    }
    return hex_array.join("");
}

// reverse conversion using lookups
/**
 * Converts hex string to bytes
 * 
 * @param {string} s
 * @returns {Uint8Array}
 */
function hexToBytes(s) {
    s = s.toLowerCase();
    const length2 = s.length;
    if (length2 % 2 !== 0) {
        throw "hex string must have length a multiple of 2";
    }
    const length = length2 / 2;
    const result = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        const i2 = i * 2;
        const b = s.substring(i2, i2 + 2);
        result[i] = to_byte_map[b];
    }
    return result;
}

/**
 * Converts string to bytes with `size` dimention
 * 
 * @param {string} str
 * @param {number} size
 * @returns {Uint8Array}
 */
function stringToBytes(str, size = 1) {
    let buf;
    let bufView;
    if (size === 1) {
        buf = new ArrayBuffer(str.length);
        bufView = new Uint8Array(buf);
    }
    if (size === 2) {
        buf = new ArrayBuffer(str.length * 2);
        bufView = new Uint16Array(buf);
    }
    if (size === 4) {
        buf = new ArrayBuffer(str.length * 4);
        bufView = new Uint32Array(buf);
    }
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return new Uint8Array(bufView.buffer);
}


/**
 * @private
 * @param {number} crc
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function _crc32c(crc, bytes) {
    const POLY = 0x82f63b78;

    crc ^= 0xffffffff;
    for (let n = 0; n < bytes.length; n++) {
        crc ^= bytes[n];
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
        crc = crc & 1 ? (crc >>> 1) ^ POLY : crc >>> 1;
    }
    return crc ^ 0xffffffff;
}

/**
 * Calculates crc32 checksum
 * 
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
function crc32c(bytes) {
    //Version suitable for crc32-c of BOC
    const int_crc = _crc32c(0, bytes);
    const arr = new ArrayBuffer(4);
    const view = new DataView(arr);
    view.setUint32(0, int_crc, false);
    return new Uint8Array(arr).reverse();
}

/**
 * Calculates crc16 checksum
 * 
 * @param {ArrayLike<number>} data
 * @returns {Uint8Array}
 */
function crc16(data) {
    const poly = 0x1021;
    let reg = 0;
    const message = new Uint8Array(data.length + 2);
    message.set(data);
    for (let byte of message) {
        let mask = 0x80;
        while (mask > 0) {
            reg <<= 1;
            if (byte & mask) {
                reg += 1;
            }
            mask >>= 1
            if (reg > 0xffff) {
                reg &= 0xffff;
                reg ^= poly;
            }
        }
    }
    return new Uint8Array([Math.floor(reg / 256), reg % 256]);
}

/**
 * Concat bytes
 * 
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {Uint8Array}
 */
function concatBytes(a, b) {
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}

/**
 * Compare bytes
 * 
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
function compareBytes(a, b) {
    // TODO Make it smarter
    return a.toString() === b.toString();
}

const base64abc = (() => {
    const abc = []
    const A = "A".charCodeAt(0);
    const a = "a".charCodeAt(0);
    const n = "0".charCodeAt(0);
    for (let i = 0; i < 26; ++i) {
        abc.push(String.fromCharCode(A + i));
    }
    for (let i = 0; i < 26; ++i) {
        abc.push(String.fromCharCode(a + i));
    }
    for (let i = 0; i < 10; ++i) {
        abc.push(String.fromCharCode(n + i));
    }
    abc.push("+");
    abc.push("/");
    return abc;
})();

/**
 * Converts bytes to base64 string
 * 
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
    let result = "";
    let i;
    const l = bytes.length;
    for (i = 2; i < l; i += 3) {
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += base64abc[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
        result += base64abc[bytes[i] & 0x3f];
    }
    if (i === l + 1) {
        // 1 octet missing
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[(bytes[i - 2] & 0x03) << 4];
        result += "==";
    }
    if (i === l) {
        // 2 octets missing
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += base64abc[(bytes[i - 1] & 0x0f) << 2];
        result += "=";
    }
    return result;
}

/**
 * Converts base64 string to binary string
 * 
 * @param {string} base64
 * @returns {string}
 */
function base64toString(base64) {
    if (typeof window === 'undefined') {
        return new Buffer(base64, 'base64').toString('binary');
    } else {
        return atob(base64);
    }
}

/**
 * Converts string to base64
 * 
 * @param {string} s
 * @returns {string}
 */
function stringToBase64(s) {
    if (typeof window === 'undefined') {
        return Buffer.from(s, "binary").toString('base64')
    } else {
        return btoa(s);
    }
}

/**
 * Converts base64 string to bytes
 * 
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
    const binary_string = base64toString(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

/**
 * Reads n-th byte uint from array
 * 
 * @param {number} n Byte length of uint
 * @param {Uint8Array} ui8array Array to read from
 * @returns {number}
 */
function readNBytesUIntFromArray(n, ui8array) {
    let res = 0;
    for (let c = 0; c < n; c++) {
        res *= 256;
        res += ui8array[c];
    }
    return res;
}

module.exports = {
    BN,
    nacl,
    bip39,
    sha256,
    sha512,
    fromNano,
    toNano,
    bytesToHex,
    hexToBytes,
    stringToBytes,
    crc32c,
    crc16,
    concatBytes,
    bytesToBase64,
    base64ToBytes,
    base64toString,
    stringToBase64,
    compareBytes,
    readNBytesUIntFromArray,
    bytesToBinString,
    bytesToString,
    stringToArray
};
