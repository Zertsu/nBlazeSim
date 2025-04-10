"use strict";

class SimUI {
    constructor(parentElement, prog) {
        this.prog = prog
        this.parentElement = parentElement
        this.running = false
        this.breakPoints = new Set()
    }

    replaceCode(prog) {
        this.prog = prog
        this.breakPoints.clear()
    }

    reset() {
        this.running = false
        this.updateButtons()
    }

    scrollIntoView(s) {
        this.el.pmem[s.PC]?.scrollIntoView({block: "nearest", inline: "nearest"})
    }

    setRunFreq(period) {
        this.runPeriod = period
    }

    delete() {
        this.running = false
        this.el.mainEl.remove()
    }

    updateButtons() {
        const b = this.el.btn
        b.step.disabled = this.running
        b.run.value = this.running ? "Stop" : "Run"
    }

    bpchange() {
        // Do nothing
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

    #modifyState(el, tar) {
        if (this.running) {return}
        const switchbackDone = [false];
        const g = SimUI.htmlGen.bind(this)
        const changeEl = g("input", {klass: "valChange", type: "text", value: el.innerText, event: {
            change: e => {
                if(!switchbackDone[0]) {
                    switchbackDone[0] = true
                    e.target.replaceWith(el)
                }
                this.processMod(tar, e.target.value)
            },
            focusout: e => {
                if(!switchbackDone[0]) {
                    switchbackDone[0] = true
                    e.target.replaceWith(el)
                }
            }
        }})
        el.replaceWith(changeEl);
        changeEl.select()
        const vsplt = changeEl.value.split(" ")
        if(vsplt.length > 1) {
            changeEl.setSelectionRange(0, vsplt[0].length)
        }
    }

    genUI(modContents, scratchPadSize = 64, banked = false) {
        const el = {btn: {}, dmem: [], pmem: [], reg: [], stack: []}
        if (banked) {
            el.breg = []
        }

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
                            this.bpchange()
                        } else {
                            this.breakPoints.delete(i)
                            this.bpchange()
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

        const genArr = (len, prefix, store, base, changeName) => {
            const arr = []
            base ??= 10
            for (let i = 0; i < len; i++) {
                const iel = g("div")
                arr.push(g(
                    "div", {}, prefix !== null ? [
                        g("div", {innerText: prefix + i.toString(base).toUpperCase()}),
                        iel
                    ] : [iel]
                ))
                if(changeName) {
                    iel.addEventListener("click", (ce) => {
                        this.#modifyState(ce.target, [changeName, i])
                    })
                }
                store.push(iel)
            }
            return arr
        }

        const genSpec = () => {
            const arr = []
            for (const e of ["PC", "ZF", "CF", "intEn", "intRq", "actRB"]) {
                const iel = g("div")
                arr.push(g("div", {}, [
                    g("div", {innerText: e}),
                    iel
                ]))
                iel.addEventListener("click", (ce) => {
                    this.#modifyState(ce.target, e)
                })
                el[e] = iel
            }
            return arr
        }

        const cont = g("div", {klass: "simCont"}, [
            g("div", {klass: "controls"}, [
                g("input", {type: "button", value: "Reset"    , klass: "rstBtn" , event: this.reset  , after: (e) => el.btn.rst = e  }),
                g("input", {type: "button", value: "Interrupt", klass: "intBtn" , event: this.trigInt, after: (e) => el.btn.inter = e}),
                g("input", {type: "button", value: "Step"     , klass: "stepBtn", event: this.step   , after: (e) => el.btn.step = e }),
                g("input", {type: "button", value: "Run"      , klass: "runBtn" , event: this.run    , after: (e) => el.btn.run = e  }),
                g("input", {type: "number", value: this.runPeriod, klass: "freqIn", 
                    event: {change: e => this.setRunFreq(parseFloat(e.target.value))},
                    after: e => {el.freqIn = e}
                }),
            ]),

            g("div", {klass: ["pmemOuter", "tOuter"]}, [
                g("div", {innerText: "Program Memory"}),
                g("div", {klass: ["pmem", "tCont"], after: (e) => el.pmemPar = e}, genPmem())
            ]),

            g("div", {klass: ["dmemOuter", "tOuter"]}, [
                g("div", {innerText: "Data Memory"}),
                g("div", {klass: ["dmem", "tCont"], style: `--cc: ${scratchPadSize}`}, genArr(scratchPadSize, "", el.dmem, undefined, "dmem"))
            ]),

            g("div", {klass: ["regOuter", "tOuter"]}, [
                g("div", {innerText: "Registers"}),
                g("div", {klass: banked ? ["regbanked", "tCont"] : ["reg", "tCont"], style: "--cc: 64"}, [
                    ...genArr(16, "s", el.reg, 16, "reg"),
                    ...(banked ? genArr(16, null, el.breg, 16, "breg") : []),
                    g("div", {klass: "tHeader", innerText: "Other registers"}),
                    ...genSpec()

                ])
            ]),

            g("div", {klass: ["stackOuter", "tOuter"], style: "--cc: 64"}, [
                g("div", {innerText: "Stack"}),
                g("div", {klass: ["stack", "tCont"]}, genArr(32, null, el.stack, undefined, "stack"))
            ]),
    
            g("div", {klass: "simModOuter"}, modContents)
        ])

        el.mainEl = cont
        
        if (document.contains(this?.el?.mainEl)) {
            this.el.mainEl.replaceWith(el.mainEl)
        } else {
            this.parentElement.appendChild(el.mainEl)
        }
        this.el = el
    }

    updateUI(s) {
        const el = this.el
        
        for (let i = 0; i < s.reg.length; i++) {
            el.reg[i].innerText = s.reg[i]
        }
        if (el.breg) {
            for (let i = 0; i < s.breg.length; i++) {
                el.breg[i].innerText = s.breg[i]
            }
            el.actRB.innerText = s.actRB ? "B" : "A"
        }
        for (let i = 0; i < s.stack.length; i++) {
            const stel = el.stack[i]
            if (Array.isArray(s.stack[i])) {
                if (s.stack[i][4]) {
                    stel.innerText = `${s.stack[i][0]} ${s.stack[i][1] ? '1' : '0'}${s.stack[i][2] ? '1' : '0'}${s.stack[i][3] ? 'B' : 'A'}`   
                } else {
                    stel.innerText = s.stack[i][0]
                }
            } else {
                stel.innerText = s.stack[i]
            }
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
        el.pmem[s.PC]?.classList?.add("active")
    }
}
