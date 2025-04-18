"use strict";


class CompUI {
    constructor(parentElement, compClass, simClass, options, genSim, closeHandler, actnBlazeSimVer) {
        this.parentElement = parentElement
        this.simClass = simClass
        this.compClass = compClass
        this.instOptions = options
        this.closeHandler = closeHandler
        this.actnBlazeSimVer = actnBlazeSimVer
        this.parentElement.appendChild(this.mainEl = this.#genUI())
        if (genSim) {
            this.compile()
        }
    }

    loadState(s) {
        if(s.lsrc === true) {
            this.srcEl.value = s.src
            this.compile()
        } else if (s.lsrc === false) {
            this.srcEl.value = s.src
            return
        } else {
            this.srcEl.value = s.lsrc
            this.compile()
            this.srcEl.value = s.src
        }

        this.simUI.el.freqIn.value = s.debug.timescale
        this.simUI.setRunFreq(s.debug.timescale)

        this.simUI.breakPoints.clear()
        for (const e of this.simUI.el.pmemPar.querySelectorAll("input:checked")) {
            e.checked = false
        }

        for (let i = 0; i < s.debug.brakepoints.length; i++) {
            const bp = s.debug.brakepoints[i];
            this.simUI.el.pmem[bp].getElementsByTagName("input")[0].checked = true
            this.simUI.breakPoints.add(bp)
        }
        const sim = this.simUI.sim
        sim.loadState(s.sim)

        const mods = {}
        for (let i = 0; i < this.simUI.mods.length; i++) {
            const m = this.simUI.mods[i];
            mods[m.name] = m
        }
        let mod;
        for (let i = 0; i < s.mods.length; i++) {
            const m = s.mods[i];
            const lastMods = new Set(this.simUI.actMods)
            this.simUI.addModule(mods[m.name], m.opts, m.state)
            mod = this.simUI.actMods.difference(lastMods).values().next().value

            const addrEl = mod.el.addrList.getElementsByTagName("input")
            for (let j = 0; j < m.addr.length; j++) {
                const a = m.addr[j];
                mod.addr[j].addr = a
                addrEl[j].value = a
            }
            if (m.enInt !== undefined) {
                addrEl[addrEl.length - 1].checked = m.enInt
                mod.enInt = m.enInt
            }
            mod.updateUI(true)
        }
        if (mod) {
            mod.updateHand.addrUpd(mod)
        }
        this.simUI.updateUI()
    }

    saveState() {
        const sim = this?.simUI?.sim
        if (sim) {
            return {
                nBlazeSimVer: this.actnBlazeSimVer,
                arch: this.compClass.archName,
                archopts: this.instOptions,
                src: this.srcEl.value,
                lsrc: this.srcEl.value === this.lsrc ? true : this.lsrc,
                debug: {
                    timescale: this.simUI.runPeriod,
                    brakepoints: Array.from(this.simUI.breakPoints)
                },
                sim: sim.saveState(),
                mods: (() => {
                    const a = []
                    for (const m of this.simUI.actMods) {
                        a.push({
                            name: m.constructor.name,
                            addr: m.addr.map(e => e.addr),
                            opts: m.opts,
                            state: m.state,
                            enInt: m.enInt
                        })
                    }
                    return a
                })()
            }
        } else {
            return {
                nBlazeSimVer: this.actnBlazeSimVer,
                arch: this.compClass.archName,
                archopts: this.instOptions,
                src: this.srcEl.value,
                lsrc: false,
            }
        }
    }
    compile() {
        const src = this.srcEl.value
        try {
            this.prog = new this.compClass(src)
        } catch (err) {
            if (err instanceof CompError) {
                alert(`Error on line ${err.line + 1}:\n\t${src.split("\n")[err.line]}\n${err.message}`)
            } else {
                alert(`Unknown error:\n${err.message}\nCall stack:\n${err.stack}`)
            }
            return
        }
        this.binEl.value = this.#bytecodeToStr(this.prog.bytecode)
        if (!this.simUI) {
            this.simUI = new this.simClass(this.simEl, this.prog, this.instOptions)
            this.expBtnEl.disabled = false
        } else {
            this.simUI.replaceCode(this.prog)
        }
        this.lsrc = src
    }

    async export() {
        if (this.srcEl.value !== this.lsrc) {
            if(!window.confirm("Source have been changed since last compilation. Proceed?")) {
                return
            }
        }
        let vhd = await vhdGen.genVHD(this.prog)
        vhdGen.downlaodFile("prog_memory.vhd", vhd)
    }

    delete() {
        if (this.simUI) {
            this.simUI.delete()
        }
        this.mainEl.remove()
        this.closeHandler(this)
    }

    #bytecodeToStr(c) {
        var o = ""
        for (let i = 0; i < c.length; i++) {      
            o += this.compClass.bytecode2bin(c[i]) + "\n"
        }
        return o
    }
    

    #genUI() {
        const g = SimUI.htmlGen.bind(this)

        return g("div", {klass: "compCont"}, [
            g("input", {type: "button", value: "X", klass: "delBtn",
                event: this.delete
            }),
            g("input", {type: "button", value: "Compile", klass: "compBtn", 
                event: this.compile
            }),
            g("input", {type: "button", value: "Export", klass: "expBtn", 
                event: this.export,
                after: e => {e.disabled = true; this.expBtnEl = e}
            }),
            g("input", {type: "button", value: "Save", klass: "saveBtn",
                event: e => {vhdGen.downlaodFile("proj.json", JSON.stringify(this.saveState()))}
            }),
            g("input", {type: "button", value: "Show bin", klass: "binBtn",
                event: e => {
                    const cl = this.mainEl.classList
                    if(cl.contains("showBin")) {
                        cl.remove("showBin")
                        e.target.value = "Show bin"
                    } else {
                        cl.add("showBin")
                        e.target.value = "Hide bin"
                    }
                }
            }),
            g("textarea", {klass: "srcText", after: e => this.srcEl = e, attr: {spellcheck: false}}),
            g("textarea", {klass: "binText", after: e => this.binEl = e, attr: {spellcheck: false, readonly: ""}}),
            g("div", {klass: "simContainer", after: e => this.simEl = e})
        ])
    }
}
