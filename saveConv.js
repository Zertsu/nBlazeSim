"use strict";

class saveConverter {
    static #updaters = {
        1: (e => {
            e.nBlazeSimVer = 2
            e.lsrc = true
            e.arch = "nblaze"
            e.archopts = {}
            return e
        })
    }

    static update(cnf, targetVer) {
        while (cnf.nBlazeSimVer != targetVer) {
            const upd = this.#updaters[cnf.nBlazeSimVer]
            if (upd) {
                cnf = upd(cnf)
            } else {
                throw new Error(`Cant convert version ${cnf.nBlazeSimVer} to ${targetVer}`);
            }
        }
        return cnf
    }
}
