"use strict";

class LedMod extends SimMod {
    static name = "Leds"
    static opts = [
        {op: "n", type: "number", val: 4, desc: "Number of LEDs"}
    ]

    constructor(opts, callbacks) {
        super("LEDs", callbacks, [
            {addr: "w1", rw: "rw", desc: "Leds"}
        ])
        this.state = {leds : 0}
        this.nleds = 4
        if (opts.n) {
            this.nleds = opts.n
        }
        this.updateReq = false
        this.el.modCont.appendChild(this.#genUI())
    }

    callbacks = [(rw, data, addr) => {
        if (rw == "r") {
            return this.state.leds
        }
        if (rw == "w") {
            this.state.leds = data
            this.updateReq = true
        }
    }]

    updateUI() {
        if (!this.updateReq) {
            return
        }
        let d = this.state.leds
        for (let i = this.leds.length - 1; i >= 0 ; i--) {
            const l = this.leds[i];
            if(d & 1) {
                l.classList.add("active")
            } else {
                l.classList.remove("active")
            }
            d >>= 1;
        }
        this.updateReq = false
    }

    #genUI() {
        const g = SimUI.htmlGen.bind(this)
        this.leds = []
        for (let i = 0; i < this.nleds; i++) {
            this.leds.push(
                g("div", {klass: ["sMod", "led"]})
            )
        }
        return g("div", {klass: "ledCont"}, this.leds)
    }
}

class SwitchMod extends SimMod {
    static name = "Switches"
    static opts = [
        {op: "n", type: "number", val: 4, desc: "Number of switches"}
    ]

    constructor(opts, callbacks) {
        super("Switches", callbacks, [
            {addr: "2", rw: "r", desc: "Switches"}
        ])
        this.state = {switches: 0}
        this.nsw = 4
        if (opts.n) {
            this.nsw = opts.n
        }
        this.el.modCont.appendChild(this.#genUI())
    }

    callbacks = [(rw, data, addr) => {
        if (rw == "r") {
            return this.state.switches
        }
    }]
    
    updateUI() {
        // do nothing
    }

    #genUI() {
        const g = SimUI.htmlGen.bind(this)
        this.sws = []
        for (let i = this.nsw - 1; i >= 0 ; i--) {
            this.sws.push(
                g("input", {type: "checkbox", event : {change: (e) => {
                    if (e.target.checked) {
                        this.state.switches |= 1 << i
                    } else {
                        this.state.switches &= ~(1 << i)
                    }
                }}}),
            )
        }
        return g("div", {klass: "swCont"}, this.sws)
    }
}

class StackMod extends SimMod {
    static name = "Stack"
    static opts = [
        {op: "size", type: "number", val: 32, desc: "Size"}
    ]

    constructor(opts, callbacks) {
        super("Stack", callbacks, [
            {addr: "3", rw: "rw", desc: "Push/Pop"},
            {addr: "4", rw: "r", desc: "Length"}
        ])
        this.size = opts.size
        this.state = {stack: []}
        this.updateReq = false
        this.el.modCont.appendChild(this.#genUI())
    }

    callbacks = [
        (rw, data, addr) => {
            if (rw == "r") {
                const e = this.state.stack.pop()
                this.updateReq = true
                return e === undefined ? 0 : e
            }
            if (rw == "w") {
                if (this.state.stack.length < this.size) {
                    this.state.stack.push(data)
                    this.updateReq = true
                }
            }
        },
        (rw, data, addr) => {
            if (rw == "r") {
                return this.state.stack.length
            }
        }
    ]

    updateUI() {
        if (!this.updateReq) {
            return
        }
        const stack = this.state.stack
        const stackEls = this.el.stack
        
        this.el.lenEl.innerText = stack.length
        for (let i = 0; i < stack.length; i++) {
            stackEls[i].innerText = stack[i]
            stackEls[i].style.visibility = "visible"
        }
        for (let i = stack.length; i < this.size; i++) {
            stackEls[i].style.visibility = null
        }
        this.updateReq = false
    }

    #genUI() {
        const g = SimUI.htmlGen.bind(this)

        const genList = () => {
            const o = []
            this.el.stack = []
            for (let i = 0; i < this.size; i++) {
                o.push(g("div", {innerText: "", after: e => this.el.stack.push(e)}))
            }
            return o
        }

        return g("div", {klass: "stackCon"}, [
            g("div", {klass: "stackHeader"}, [
                g("span", {innerText: "Length: "}),
                g("span", {innerText: "0", after: e => this.el.lenEl = e})
            ]),
            g("div", {klass: "stackContent"}, genList())
        ])
    }
}
