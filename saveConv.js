"use strict";

class saveConverter {
    static #updaters = {
        1: (e => {
            e.nBlazeSimVer = 2
            e.lsrc = true
            e.arch = "nblaze"
            e.archopts = {}
            return e
        }),
        2: (e => {
            e.nBlazeSimVer = 3
            if(e.arch == "kp6" && e.sim) {
                e.sim.stack = e.sim.stack.map(el => {
                    return [el - 1, false, false, false, false]
                })
            }
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
