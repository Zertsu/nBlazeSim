"use strict";

class SimUI {
    mods = [LedMod, SwitchMod, StackMod, MemMapMod]


    constructor(parentElement, prog) {
        this.prog = prog
        this.sim = new Sim(prog.bytecode, this.#hanPortReq.bind(this))
        this.parentElement = parentElement

        this.running = false
        this.runPeriod = 100
        this.lastExec = undefined
        this.actMods = new Set()
        this.breakPoints = new Set()
        this.ports = {r: {}, w: {}}
        
        this.#genUI()
        this.#updateUI()
    }

    replaceCode(prog) {
        this.running = false
        this.prog = prog
        this.sim.pmem = this.prog.bytecode
        this.sim.reset()
        this.breakPoints.clear()
        this.#genUI()
        this.#updateUI()
    }

    reset() {
        this.running = false
        this.sim.reset()
        for (const m of this.actMods) {
            m.reset()
        }
        this.#updateUI()
        this.#updateButtons()
    }

    step() {
        if(!this.running) {
            this.sim.runCycle()
            this.#updateUI()
            this.#scrollIntoView()
        }
    }

    #scrollIntoView() {
        this.el.pmem[this.sim.PC].scrollIntoView({block: "nearest", inline: "nearest"})
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
                this.#updateUI()
                requestAnimationFrame(af)
            }
            requestAnimationFrame(af)
        }
        this.#updateButtons()
    }

    trigInt() {
        this.sim.trigInt()
        this.#updateUI()
    }

    setRunFreq(period) {
        this.runPeriod = period
    }

    delete() {
        this.running = false
        this.el.mainEl.remove()
    }

    #updateButtons() {
        const b = this.el.btn
        b.step.disabled = this.running
        b.run.value = this.running ? "Stop" : "Run"
    }

    #hanPortReq(rw, portID, data) {
        const l = this.ports[rw]
        if (l.hasOwnProperty(portID)) {
            return l[portID](rw, data, portID)
        } else {
            return 0
        }
    }

    #callbacks = {
        delete: (e) => {
            this.actMods.delete(e)
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
        trigInter: e => this.sim.trigInt()
    }

    addModule(mod, opts) {
        const m = new mod(opts, this.#callbacks)
        this.actMods.add(m)
        this.#callbacks.addrUpd()
        this.el.modsCont.appendChild(m.contEl)
    }


    static htmlGen(t, opts, children) {
        const el = typeof t === "string" ? document.createElement(t) : t
        if (children !== undefined) {
            if (Array.isArray(children)) {
                for (let i = 0; i < children.length; i++) {
                    el.appendChild(children[i])
                }
            } else {
                el.appendChild(children)
            }
        }
        if (opts !== undefined) {
            if (opts.klass !== undefined) {
                if (Array.isArray(opts.klass)) {
                    el.classList.add(...opts.klass)
                } else {
                    el.classList.add(opts.klass)
                }
            }
            if (opts.type !== undefined) {el.type = opts.type}
            if (opts.value !== undefined) {el.value = opts.value}
            if (opts.innerText !== undefined) {el.innerText = opts.innerText}
            if (opts.style !== undefined) {el.style = opts.style}
            if (opts.event !== undefined) {
                if (opts.event instanceof Function) {
                    el.addEventListener("click", opts.event.bind(this))
                } else {
                    for (const [key, value] of Object.entries(opts.event)) {
                        el.addEventListener(key, value.bind(this))
                    }
                }
            }
            if (opts.attr !== undefined) {
                for (const att in opts.attr) {
                    el.setAttribute(att, opts.attr[att])
                }
            }
            if (opts.after instanceof Function) {
                opts.after(el)
            }
        }
        return el
    }

    #genUI() {
        const el = {btn: {}, dmem: [], pmem: [], reg: [], stack: []}

        const g = SimUI.htmlGen.bind(this)

        const genPmem = () => {
            const p = this.prog
            let arr = []
            let nempty = 0

            for (let i = 0; i < p.bytecode.length; i++) {
                if (p.bytecode[i] == undefined) {
                    nempty++
                    continue
                }
                if (nempty > 0) {
                    arr.push(g("div", {klass: "dmemempty", innerText: nempty + " empty addresses"}))
                    nempty = 0
                }
                arr.push(g("div", {after: (e) => {el.pmem[i] = e}}, [
                    g("input", {type: "checkbox", event: {change: e => {
                        if (e.target.checked) {
                            this.breakPoints.add(i)
                        } else {
                            this.breakPoints.delete(i)
                        }
                    }}, after: e => {
                        if (Comp.isSelfJump(i, p.bytecode[i])) {
                            e.checked = true
                            this.breakPoints.add(i)
                        }
                    }}),
                    g("div", {innerText: p.lineLabels[i] == undefined ? i : i + " " + p.lineLabels[i]}),
                    g("div", {innerText: p.bytecode2str(p.bytecode[i])})
                ]))
            }
            return arr
        }

        const genArr = (len, prefix, store, base) => {
            const arr = []
            base ??= 10
            for (let i = 0; i < len; i++) {
                const iel = g("div")
                arr.push(g(
                    "div", {}, [
                        g("div", {innerText: prefix + i.toString(base).toUpperCase()}),
                        iel
                    ]
                ))
                store.push(iel)
            }
            return arr
        }

        const genSpec = () => {
            const arr = []
            for (const e of ["PC", "ZF", "CF", "intEn", "intRq"]) {
                const iel = g("div")
                arr.push(g("div", {}, [
                    g("div", {innerText: e}),
                    iel
                ]))
                el[e] = iel
            }
            return arr
        }

        const genModOpt = () => {
            let arr = []
            for (let i = 0; i < this.mods.length; i++) {
                const mod = this.mods[i];
                arr.push(g("option", {value: i, innerText: mod.name}))
            }
            return arr  
        }

        const genSelModOpts = () => {
            const cl = this.mods[this.el.modSel.selectedIndex]
            let arr = []
            let inputs = {}
            for (let i = 0; i < cl.opts.length; i++) {
                const op = cl.opts[i];
                arr.push(g("div", {}, [
                    g("span", {innerText: op.desc}),
                    g("input", {type: op.type, value: op.val, after: (e) => inputs[op.op] = e})
                ]))
            }
            arr.push(g("div", {}, [
                g("input", {type: "button", value: "Add", event: (e) => {
                    let opts = {}
                    for (const [key, value] of Object.entries(inputs)) {
                        let v = value.value
                        if (value.type == "number") {
                            v = parseInt(v)
                        }
                        opts[key] = v
                    }
                    this.addModule(cl, opts)
                }})
            ]))
            this.el.modSelOut.innerHTML = ""
            for (let i = 0; i < arr.length; i++) {
                this.el.modSelOut.appendChild(arr[i])
            }
        }

        const cont = g("div", {klass: "simCont"}, [
            g("div", {klass: "controls"}, [
                g("input", {type: "button", value: "Reset"    , klass: "rstBtn" , event: this.reset  , after: (e) => el.btn.rst = e  }),
                g("input", {type: "button", value: "Interrupt", klass: "intBtn" , event: this.trigInt, after: (e) => el.btn.inter = e}),
                g("input", {type: "button", value: "Step"     , klass: "stepBtn", event: this.step   , after: (e) => el.btn.step = e }),
                g("input", {type: "button", value: "Run"      , klass: "runBtn" , event: this.run    , after: (e) => el.btn.run = e  }),
                g("input", {type: "number", value: this.runPeriod, klass: "freqIn", event: {change: e => this.setRunFreq(parseFloat(e.target.value))}}),
            ]),

            g("div", {klass: ["pmemOuter", "tOuter"]}, [
                g("div", {innerText: "Program Memory"}),
                g("div", {klass: ["pmem", "tCont"], after: (e) => el.pmemPar = e}, genPmem())
            ]),

            g("div", {klass: ["dmemOuter", "tOuter"]}, [
                g("div", {innerText: "Data Memory"}),
                g("div", {klass: ["dmem", "tCont"]}, genArr(64, "", el.dmem))
            ]),

            g("div", {klass: ["regOuter", "tOuter"]}, [
                g("div", {innerText: "Registers"}),
                g("div", {klass: ["reg", "tCont"]}, [
                    ...genArr(16, "s", el.reg, 16),
                    g("div", {klass: "tHeader", innerText: "Other registers"}),
                    ...genSpec()

                ])
            ]),

            g("div", {klass: ["stackOuter", "tOuter"]}, [
                g("div", {innerText: "Stack"}),
                g("div", {klass: ["stack", "tCont"]}, genArr(32, "", el.stack))
            ]),
    
            g("div", {klass: "simModOuter"}, [
                g("div", {klass: "modSelector"}, [
                    g("select", {event: {change: genSelModOpts}, after: (e) => {
                        el.modSel = e
                        if (this?.el?.modSel !== undefined) {
                            e.value = this.el.modSel.value
                        }
                    }}, 
                        genModOpt()
                    ),
                    g("div", {klass: "modOpt", after: (e) => el.modSelOut = e})
                ]),
                this?.el?.modsCont === undefined ?
                    g("div", {klass: "modsCont", after: (e) => el.modsCont = e})
                :   g(this.el.modsCont, {after: (e) => el.modsCont = e})
            ])
        ])

        el.mainEl = cont
        
        if (document.contains(this?.el?.mainEl)) {
            this.el.mainEl.replaceWith(el.mainEl)
        } else {
            this.parentElement.appendChild(el.mainEl)
        }
        this.el = el
        genSelModOpts()
    }

    #updateUI() {
        const el = this.el
        const s = this.sim
        
        for (let i = 0; i < s.reg.length; i++) {
            el.reg[i].innerText = s.reg[i]
        }
        for (let i = 0; i < s.stack.length; i++) {
            const stel = el.stack[i]
            stel.innerText = s.stack[i]
            stel.parentElement.style.visibility = "visible"
        }
        for (let i = s.stack.length; i < 32; i++) {
            el.stack[i].parentElement.style.visibility = null
        }
        for (let i = 0; i < s.dmem.length; i++) {
            el.dmem[i].innerText = s.dmem[i]
        }
    
        el.PC.innerText = s.PC
        el.ZF.innerText = s.ZF
        el.CF.innerText = s.CF
        el.intRq.innerText = s.intrq
        el.intEn.innerText = s.intEn
        el.btn.inter.disabled = ! s.intEn
    
        for (const e of el.pmemPar.getElementsByClassName("active")) {
            e.classList.remove("active")
        }
        el.pmem[s.PC].classList.add("active")


        for (const m of this.actMods) {
            m.updateUI()
        }
    }
}

class SimMod {
    constructor(name, updateHand, hasInt, addrList, span) {
        this.updateHand = updateHand
        this.addr = addrList
        this.hasInt = hasInt
        this.#genContainer(name, addrList, span)
    }

    interrupt() {
        if (this.enInt) {
            this.updateHand.trigInter()
        }
    }

    #delete() {
        for (let i = 0; i < this.addr.length; i++) {
            this.addr[i].addr = ""
        }
        this.updateHand.delete(this)
        this.contEl.remove()
    }

    #genContainer(name, addrList, span) {
        this.el = {}

        const g = SimUI.htmlGen.bind(this)

        const genAddrList = () => {
            let o = []
            for (let i = 0; i < addrList.length; i++) {
                const add = addrList[i];
                o.push(g("div", {}, [
                    g("input", {type: "text", value: add.addr, event: {change: e => {
                        this.addr[i].addr = e.target.value
                        this.updateHand.addrUpd(this)
                    }}}),
                    g("span", {innerText: add.rw}),
                    g("span", {innerText: add.desc})
                ]))
            }
            if (this.hasInt) {
                this.enInt = false
                o.push(g("div", {klass: "intEnLine"}, [
                    g("input", {type: "checkbox", event: {change: e => {
                        this.enInt = e.target.checked
                    }}}),
                    g("span", {innerText: "Enable interrupts"})
                ]))
            }
            return o
        }

        if (!span) {
            span = {x: 1, y: 1}
        }
        const style = `--spanX: ${span.x}; --spanY: ${span.y}`

        this.contEl = g("div", {klass: "modOuter", style: style}, [
            g("div", {klass: "modHeader"}, [
                g("div", {innerText: name}),
                g("input", {type: "button", value: "X", event: e => this.#delete()}),
                g("div", {klass: "modSel",after: (e) => this.el.addrList = e}, genAddrList())
            ]),
            g("div", {klass: "modCont", after: (e) => this.el.modCont = e})
        ])
    }
}
