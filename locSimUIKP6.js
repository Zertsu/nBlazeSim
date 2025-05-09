"use strict";

class locSimUIKP6 extends SimUI {
    mods = [LedMod, SwitchMod, StackMod, MemMapMod, ParLCDMod, KeyboardMod]

    constructor(parentElement, prog, options) {
        super(parentElement, prog)
        this.instOptions = options
        this.sim = new locSimKP6(prog.bytecode, this.#hanPortReq.bind(this), options)
        this.runPeriod = 100
        this.lastExec = undefined
        this.actMods = new Set()
        this.updsMods = new Set()
        this.ports = {r: {}, w: {}}
        this.genUI()
        this.updateUI()
    }

    replaceCode(prog) {
        this.running = false
        super.replaceCode(prog)
        this.sim.pmem = this.prog.bytecode
        this.sim.reset()
        this.genUI()
        this.updateUI()
    }

    reset() {
        super.reset()
        this.sim.reset()
        for (const m of this.actMods) {
            m.reset()
        }
        this.updateUI()
    }

    delete() {
        for (const m of this.actMods) {
            m.delete()
        }
        super.delete()
    }

    step() {
        if(!this.running) {
            this.sim.runCycle()
            this.updateUI()
            this.scrollIntoView(this.sim)
        }
    }

    trigInt() {
        this.sim.trigInt()
        if (!this.running) {
            this.updateUI()
        }
    }

    processMod(tar, val) {
        this.sim.setState(tar, val)
        this.updateUI()
    }

    run(state) {
        if (this.running === state) {
            return
        }
        this.running = !this.running
        if (this.running) {
            const af = (t) => {
                if (!this.running) {
                    this.lastExec = undefined
                    this.#callbacks.reqUpdate(undefined, true)
                    this.updateUI()
                    return
                }
                if (this.lastExec === undefined) {
                    this.lastExec = t
                }
                while (this.lastExec + this.runPeriod < t) {
                    this.sim.runCycle()
                    this.lastExec += this.runPeriod
                    if (this.breakPoints.has(this.sim.PC)) {
                        this.run(false)
                        break
                    }
                }
                this.updateUI()
                requestAnimationFrame(af)
            }
            requestAnimationFrame(af)
        }
        this.updateButtons()
    }

    #callbacks = {
        delete: (e) => {
            this.actMods.delete(e)
            this.updsMods.delete(e)
            this.#callbacks.addrUpd()
        },
        addrUpd: (e) => {
            this.ports = {r: {}, w: {}}
            for (const m of this.actMods) {
                for (let i = 0; i < m.callbacks.length; i++) {
                    const cb = m.callbacks[i].bind(m);
                    const info = m.addr[i]
                    for (const t of info.addr.split(',')) {
                        const res = t.match(/(r|w)?((\d+):)?(\d+)(-(\d+))?/)
                        if (!res) {continue}
                        const rw = res[1] ?? "rw"
                        const offset = res[3] ? parseInt(res[3]) : 0
                        const addr = parseInt(res[4])
                        const stopAddr = res[6] ? parseInt(res[6]) + 1 : addr + 1
                        const toAddTo = []
                        if (info.rw.includes("r") && rw.includes("r")) {
                            toAddTo.push(this.ports.r)
                        }
                        if (info.rw.includes("w") && rw.includes("w")) {
                            toAddTo.push(this.ports.w)
                        }
                        const cbm = (rw, data, caddr) => {
                            return cb(rw, data, caddr - addr + offset)
                        }
                        for (let j = addr; j < stopAddr; j++) {
                            for (const l of toAddTo) {
                                l[j] = cbm
                            }
                        }
                    }
                }
            }
        },
        trigInter: e => this.sim.trigInt(),
        reqUpdate: (e, v, s) => {
            if(s && !this.running) {
                requestAnimationFrame(t => {e.updateUI()})
                return
            }
            if (v) {
                if (e) {
                    this.updsMods.add(e)
                }
                if (this.running === false && this.updsMods.size > 0) {
                    const af = t => {
                        if (this.updsMods.size === 0 || this.running) {
                            return
                        }
                        for (const m of this.updsMods) {
                            m.updateUI()
                        }
                        requestAnimationFrame(af)
                    }
                    requestAnimationFrame(af)
                }
            } else {
                this.updsMods.delete(e)
            }
        }
    }

    #hanPortReq(rw, portID, data) {
        const l = this.ports[rw]
        if (l.hasOwnProperty(portID)) {
            return l[portID](rw, data, portID)
        } else {
            return 0
        }
    }

    addModule(mod, opts, state) {
        const m = new mod(opts, this.#callbacks, state)
        m.opts = opts
        this.actMods.add(m)
        this.#callbacks.addrUpd()
        this.sel.modsCont.appendChild(m.contEl)
    }

    genUI() {
        const g = SimUI.htmlGen.bind(this)
        let sel = {}

        const genModOpt = () => {
            let arr = []
            for (let i = 0; i < this.mods.length; i++) {
                const mod = this.mods[i];
                arr.push(g("option", {value: i, innerText: mod.title}))
            }
            return arr
        }

        const genSelModOpts = () => {
            const cl = this.mods[this.sel.modSel.selectedIndex]
            let arr = []
            let inputs = {}
            for (let i = 0; i < cl.opts.length; i++) {
                const op = cl.opts[i];
                const attr = {}
                if(op.min) {attr.min = op.min}
                if(op.max) {attr.max = op.max}
                arr.push(g("div", {}, [
                    g("span", {innerText: op.desc}),
                    g("input", {type: op.type, value: op.val, attr: attr, after: (e) => inputs[op.op] = e})
                ]))
            }
            arr.push(g("div", {}, [
                g("input", {type: "button", value: "Add", event: (e) => {
                    let opts = {}
                    for (const [key, value] of Object.entries(inputs)) {
                        let v = value.value
                        if (value.type == "number") {
                            v = parseInt(v)
                            if(value.max !== undefined) {
                                const maxval = parseInt(value.max)
                                if(v > maxval) {
                                    alert(`Value must be at most ${maxval}`)
                                    return
                                }
                            }
                            if(value.min !== undefined) {
                                const minval = parseInt(value.min)
                                if(v < minval) {
                                    alert(`Value must be at least ${minval}`)
                                    return
                                }
                            }
                        }
                        opts[key] = v
                    }
                    this.addModule(cl, opts)
                }})
            ]))
            this.sel.modSelOut.innerHTML = ""
            for (let i = 0; i < arr.length; i++) {
                this.sel.modSelOut.appendChild(arr[i])
            }
        }

        super.genUI([
            g("div", {klass: "modSelector"}, [
                g("select", {event: {change: genSelModOpts}, after: (e) => {
                    sel.modSel = e
                    if (this?.sel?.modSel !== undefined) {
                        e.value = this.sel.modSel.value
                    }
                }},
                    genModOpt()
                ),
                g("div", {klass: "modOpt", after: (e) => sel.modSelOut = e})
            ]),
            this?.sel?.modsCont === undefined ?
                g("div", {klass: "modsCont", after: (e) => sel.modsCont = e})
            :   g(this.sel.modsCont, {after: (e) => sel.modsCont = e})
        ], this.instOptions.scratch_pad_memory_size, true)
        this.sel = sel
        genSelModOpts()
    }

    updateUI() {
        super.updateUI(this.sim)
        for (const m of this.actMods) {
            m.updateUI()
        }
    }
}
