"use strict";

class LedMod extends SimMod {
    static name = "Leds"
    static opts = [
        {op: "n", type: "number", val: 4, desc: "Number of LEDs"}
    ]

    constructor(opts, callbacks) {
        super("LEDs", "w", 5, callbacks)
        this.nleds = 4
        if (opts.n) {
            this.nleds = opts.n
        }
        this.el.modCont.appendChild(this.#genUI())
    }

    callback(rw, data, addr) {
        if (rw == "w") {
            for (let i = this.leds.length - 1; i >= 0 ; i--) {
                const l = this.leds[i];
                if(data & 1) {
                    l.classList.add("active")
                } else {
                    l.classList.remove("active")
                }
                data >>= 1;
            }
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
        this.nsw = 4
        if (opts.n) {
            this.nsw = opts.n
        }
        this.el.modCont.appendChild(this.#genUI())
    }

    callback(rw, data, addr) {
        if (rw == "r") {
            let out = 0
            for (let i = 0; i < this.sws.length; i++) {
                const sw = this.sws[i];
                if (sw.checked) {
                    out |= 1
                }
                out <<= 1
            }
            return out >> 1
        }
    }

    #genUI() {
        const g = SimUI.htmlGen.bind(this)
        this.sws = []
        for (let i = 0; i < this.nsw; i++) {
            this.sws.push(
                g("input", {type: "checkbox"}),
            )
        }
        return g("div", {klass: "swCont"}, this.sws)
    }
}
