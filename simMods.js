"use strict";

class LedMod extends SimMod {
    static name = "Leds"
    static opts = [
        {op: "n", type: "number", val: 4, desc: "Number of LEDs"}
    ]

    constructor(opts, callbacks) {
        super("LEDs", "w", 5, callbacks)
        this.state = {leds : 0}
        this.nleds = 4
        if (opts.n) {
            this.nleds = opts.n
        }
        this.el.modCont.appendChild(this.#genUI())
    }

    callback(rw, data, addr) {
        if (rw == "w") {
            this.state.leds = data
        }
    }

    updateUI() {
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
        super("Switches", "r", 6, callbacks)
        this.state = {switches: 0}
        this.nsw = 4
        if (opts.n) {
            this.nsw = opts.n
        }
        this.el.modCont.appendChild(this.#genUI())
    }

    callback(rw, data, addr) {
        if (rw == "r") {
            return this.state.switches
        }
    }

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
