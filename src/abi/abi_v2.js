const {BN, base64ToBytes, sha256} = require("../utils");
const {Cell} = require("../boc/Cell");
const {HashmapE} = require("../boc/Hashmap");
const { sign } = require("tweetnacl");

class ParamStack {
    constructor() {
        this.root = new Cell();
        this.prev = null;
        this.current = this.root;
    }

    /**
     * appends data & refs from cell to stack
     * @param cell {Cell}
     */
    append(cell) {
        if (cell.refs.length > 3) {
            throw "Cannot add cell with more than 3 refs";
        }
        if (this.current.refs.length + cell.refs.length > 3 ||
            cell.bits.getUsedBits() > this.current.bits.getFreeBits()) {
            // new one
            this.current.refs.push(cell);
            this.prev = this.current;
            this.current = cell;
            return;
        }
        for (let i of cell.refs) {
            this.current.refs.push(i);
        }
        this.current.bits.writeBitString(cell.bits);
    }

    /**
     * finalize stack
     */
    finalize() {
        if (this.prev &&
                this.current.bits.getUsedBits() <= this.prev.bits.getFreeBits() &&
                this.prev.refs.length - 1 + this.current.refs.length <= 4) {
            this.prev.refs.pop();
            for (let i of this.current.refs) {
                this.prev.refs.push(i);
            }
            this.prev.bits.writeBitString(this.current.bits);
            this.current = prev;
            this.prev = null;
        }
    }
}

class AbiV2 {
    constructor(abi, tvm = '') {
        this.abi = abi;
        if (abi["ABI version"] != 2) {
            throw "Invalid abi version";
        }
        this.tvm = tvm;
    }

    /**
     * create initial code cell
     * @return {Promise<Cell>}
     */
    generateInitialCode() {
        if (this.tvm.length == 0) {
            throw "No tvm code";
        }
        
        let cell = await Cell.fromBoc(base64ToBytes(this.tvm));

        return cell;
    }

    /**
     * create initial data cell
     * @param pubkey? {Uint8Array}
     * @return {Promise<Cell>}
     */
    generateInitialData(pubkey = null) {
        const hashmap = new HashmapE(64);
        const cell = new Cell();

        if (pubkey) {
            const pk = new Cell();
            pk.bits.writeBytes(pubkey); 
            hashmap.set(0, pk);
        }

        hashmap.serialize(cell);
        return cell;
    }

    generateExtInMessage(signature = null, ) {

    }

    generateInitialState() {

    }

    generateHeader() {

    }

    generateDeployMessage() {

    }

    generateStack() {

    }

    /**
     * calculate ID
     * @param obj {Object}
     * @param name {String}
     * @return {Promise<Number>}
     */
    async getId(obj, name) {
        for (let f of this.abi['functions']) {
            if (f['name'] == name) {
                if (f["id"]) {
                    return parseInt(Number(f["id"]), 10);
                }
                let signature = name;
                let append_types = (l) => {
                    let first = false;
                    for (let i of l) {
                        if (!first) {
                            signature += ',';
                            first = true;
                        }
                        signature += i['type'];
                    }
                }
                signature += '(';
                append_types(f['inputs']);
                signature += ')(';
                append_types(f['outputs']);
                signature += ')v2';

                let enc = new TextEncoder();
                sha = await sha256(enc.encode(signature));
                let id = new Uint32Array(sha); // treat buffer as a sequence of 32-bit integers

                return id[0] & ~0x80000000;
            }
        }
        throw "No such function";
    }

    /**
     * calculate function ID
     * @param name {String}
     * @return {Promise<Number>}
     */
    async getFunctionId(name) {
        return await this.getId(this.abi['functions'], name);
    }

    /**
     * calculate event ID
     * @param name {String}
     * @return {Promise<Number>}
     */
    async getFunctionId(name) {
        return await this.getId(this.abi['events'], name);
    }
}