const {Address, Cell} = require("../../types");
const {BN, toNano, bytesToHex, hexToBytes, nacl, stringToBytes, bytesToBase64} = require("../../utils");
const {ClassicContract} = require("../ClassicContract.js");



class ElectorContract extends ClassicContract {

    constructor(options, provider) {
        super(options, provider);

        this.methods = {
            participant_list: () => {
                return {
                    /**
                     * @return {Promise<list>}
                     */
                    runLocal: async (p={}) => {
                        const res = await this._runGetMethod('participant_list', p);
                        if (res.output[0]) {
                            let r = [];
                            let members = ClassicContract.arrayFromCONS(res.output[0]);
                            for (let m in members) {
                                let member = {
                                    id: members[m][0],
                                    stake: new BN(members[m][1].replace('0x', ''), 16),
                                };
                                r.push(member);
                            }
                            return r;
                        }
                        else
                          return [];
                    }
                }
            },
            participant_list_extended: () => {
                return {
                    /**
                     * @return {Promise<list>}
                     */
                    runLocal: async (p={}) => {
                        const res = await this._runGetMethod('participant_list_extended', p);
                        if (res.output[0]) {
                            let r = {
                                elect_at: parseInt(res.output[0], 16),
                                elect_close: parseInt(res.output[1], 16),
                                min_stake: new BN(res.output[2].replace('0x', ''), 16),
                                total_stake: new BN(res.output[3].replace('0x', ''), 16),
                                members: [],
                                failed: parseInt(res.output[5], 16),
                                finished: parseInt(res.output[6], 16)
                            };
                            let members = ClassicContract.arrayFromCONS(res.output[4]);
                            for (let m in members) {
                                let member = {
                                    id: members[m][0],
                                    stake: new BN(members[m][1][0].replace('0x', ''), 16),
                                    max_factor: parseInt(members[m][1][1], 16),
                                    addr: members[m][1][2],
                                    adnl_addr: members[m][1][3]
                                };
                                r.members.push(member);
                            }
                            return r;
                        }
                        else
                          return;
                    }
                }
            },
            active_election_id: () => {
                return {
                    /**
                     * @return {Promise<number>}
                     */
                    runLocal: async (p={}) => {
                        const res = await this._runGetMethod('active_election_id', p);
                        return parseInt(res.output[0], 16);
                    }
                }
            },
            compute_returned_stake: () => {
                return {
                    /**
                     * @return {Promise<BN>}
                     */
                    runLocal: async (p={}) => {
                        const res = await this._runGetMethod('compute_returned_stake', p);
                        return new BN(res.output[0].replace('0x', ''), 16);
                    }
                }
            },
        }
    }
}


module.exports = {ElectorContract};