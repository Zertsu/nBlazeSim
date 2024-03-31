"use strict";


class CompUI {
    constructor(parentElement, simClass) {
        this.parentElement = parentElement
        this.simClass = simClass
        this.parentElement.appendChild(this.mainEl = this.#genUI())
    }

    compile() {
        const src = this.srcEl.value
        try {
            this.prog = new Comp(src)
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
            this.simUI = new this.simClass(this.simEl, this.prog)
            this.expBtnEl.disabled = false
        } else {
            this.simUI.replaceCode(this.prog)
        }
    }

    async export() {
        let vhd = await vhdGen.genVHD(this.prog)
        vhdGen.downlaodFile("prog_memory.vhd", vhd)
    }

    delete() {
        if (this.simUI) {
            this.simUI.delete()
        }
        this.mainEl.remove()
    }

    #bytecodeToStr(c) {
        var o = ""
        for (let i = 0; i < c.length; i++) {      
            o += Comp.bytecode2bin(c[i]) + "\n"
        }
        return o
    }
    

    #genUI() {
        const g = SimUI.htmlGen.bind(this)

        return g("div", {klass: "compCont"}, [
            g("input", {type: "button", value: "Delete", klass: "delBtn",
                event: this.delete
            }),
            g("input", {type: "button", value: "Compile", klass: "compBtn", 
                event: this.compile
            }),
            g("input", {type: "button", value: "Export", klass: "expBtn", 
                event: this.export,
                after: e => {e.disabled = true; this.expBtnEl = e}
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
