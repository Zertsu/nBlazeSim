"use strict";

class SimUI {
    constructor(prog, sim, parentElement) {
        this.prog = prog
        this.sim = sim
        this.parentElement = parentElement

        this.running = false
        this.runPeriod = 100
        this.lastExec = undefined
        
        this.#genUI()
        this.#updateUI()
    }

    reset() {
        this.running = false
        this.sim.reset()
        this.#updateUI()
        this.#updateButtons()
    }

    step() {
        if(!this.running) {
            this.sim.runCycle()
            this.#updateUI()
        }
    }

    run(state) {
        if (this.running === state) {
            return
        }
        this.running = !this.running
        if (this.running) {
            const af = (t) => {
                if (this.lastExec === undefined) {
                    this.lastExec = t
                }
                while (this.lastExec + this.runPeriod < t) {
                    this.sim.runCycle()
                    this.lastExec += this.runPeriod
                    if (this.el.breakP[this.sim.PC].checked) {
                        this.run(false)
                        break
                    }
                }
                this.#updateUI()
                if (this.running) {
                    requestAnimationFrame(af)
                } else {
                    this.lastExec = undefined
                }
            }
            requestAnimationFrame(af)
        } else {
            this.#updateButtons()
        }


        this.#updateButtons()
    }

    trigInt() {
        this.sim.trigInt()
        this.sim.runCycle()
        this.sim.disInt()
        this.#updateUI()
    }

    setRunFreq(period) {
        this.runPeriod = period
    }

    #updateButtons() {
        const b = this.el.btn
        b.step.disabled = this.running
        b.run.value = this.running ? "Stop" : "Run"
    }

    #genUI() {
        this.el = {btn: {}, dmem: [], pmem: [], reg: [], stack: [], breakP: []}


        const g = (t, opts, children) => {
            const el = document.createElement(t)
            if (children !== undefined) {
                for (let i = 0; i < children.length; i++) {
                    el.appendChild(children[i])
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
                if (opts.event !== undefined) {
                    if (opts.event instanceof Function) {
                        el.addEventListener("click", opts.event.bind(this))
                    } else {
                        for (const [key, value] of Object.entries(opts.event)) {
                            el.addEventListener(key, value.bind(this))
                        }
                    }
                }
                if (opts.after instanceof Function) {
                    opts.after(el)
                }
            }
            return el
        }

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
                arr.push(g("div", {after: (e) => {this.el.pmem[i] = e}}, [
                    g("input", {type: "checkbox", after: (e) => {this.el.breakP[i] = e}}),
                    g("div", {innerText: p.lineLabels[i] == undefined ? i : i + " " + p.lineLabels[i]}),
                    g("div", {innerText: p.bytecode2str(p.bytecode[i])})
                ]))
            }
            return arr
        }

        const genArr = (len, prefix, store) => {
            const arr = []
            for (let i = 0; i < len; i++) {
                const iel = g("div")
                arr.push(g(
                    "div", {}, [
                        g("div", {innerText: prefix + i}),
                        iel
                    ]
                ))
                store.push(iel)
            }
            return arr
        }

        const genSpec = () => {
            const arr = []
            for (const e of ["PC", "ZF", "CF", "intEn"]) {
                const iel = g("div")
                arr.push(g("div", {}, [
                    g("div", {innerText: e}),
                    iel
                ]))
                this.el[e] = iel
            }
            return arr
        }


        const cont = g("div", {}, [
            g("input", {type: "button", value: "Reset"    , klass: "rstBtn" , event: this.reset  , after: (e) => this.el.btn.rst = e  }),
            g("input", {type: "button", value: "Interrupt", klass: "intBtn" , event: this.trigInt, after: (e) => this.el.btn.inter = e}),
            g("input", {type: "button", value: "Step"     , klass: "stepBtn", event: this.step   , after: (e) => this.el.btn.step = e }),
            g("input", {type: "button", value: "Run"      , klass: "runBtn" , event: this.run    , after: (e) => this.el.btn.run = e  }),
            g("input", {type: "number", value: 100, klass: "freqIn", event: {change: e => this.setRunFreq(parseFloat(e.target.value))}}),

            g("br"),

            g("div", {klass: ["pmemOuter", "tOuter"]}, [
                g("div", {innerText: "Program Memory"}),
                g("div", {klass: ["pmem", "tCont"], after: (e) => this.el.pmemPar = e}, genPmem())
            ]),

            g("div", {klass: ["dmemOuter", "tOuter"]}, [
                g("div", {innerText: "Data Memory"}),
                g("div", {klass: ["dmem", "tCont"]}, genArr(64, "", this.el.dmem))
            ]),

            g("div", {klass: ["regOuter", "tOuter"]}, [
                g("div", {innerText: "Registers"}),
                g("div", {klass: ["reg", "tCont"]}, genArr(16, "s", this.el.reg))
            ]),

            g("div", {klass: ["stackOuter", "tOuter"]}, [
                g("div", {innerText: "Stack"}),
                g("div", {klass: ["stack", "tCont"]}, genArr(32, "", this.el.stack))
            ]),
            g("div", {klass: ["specOuter", "tOuter"]}, [
                g("div", {innerText: "Other registers"}),
                g("div", {klass: ["spec", "tCont"]}, genSpec())
            ]),

        ])

        this.parentElement.appendChild(cont)
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
        el.intEn.innerText = s.intEn
        el.btn.inter.disabled = ! s.intEn
    
        for (const e of el.pmemPar.getElementsByClassName("active")) {
            e.classList.remove("active")
        }
        el.pmem[s.PC].classList.add("active")
    }
}
