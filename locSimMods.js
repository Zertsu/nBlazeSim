"use strict";

class LedMod extends SimMod {
    static title = "Leds"
    static opts = [
        {op: "n", type: "number", val: 4, min: 1, max: 16, desc: "Number of LEDs"}
    ]

    constructor(opts, callbacks, state) {
        super("LEDs", callbacks, false, [
            {addr: "w1", rw: "rw", desc: "Leds"}
        ], {x: opts.n >= 10 ? 2 : 1, y: 1})
        this.state = state ?? {leds : 0}
        this.nleds = 4
        if (opts.n) {
            this.nleds = opts.n
        }
        this.updateReq = false
        this.el.modCont.appendChild(this.#genUI())
    }

    reset() {
        this.state = {leds: 0}
        this.updateReq = true
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

    updateUI(force) {
        if (!this.updateReq && !force) {
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
    static title = "Switches"
    static opts = [
        {op: "n", type: "number", val: 4, min: 1, max: 16, desc: "Number of switches"}
    ]

    constructor(opts, callbacks, state) {
        super("Switches", callbacks, false, [
            {addr: "2", rw: "r", desc: "Switches"}
        ], {x: opts.n >= 10 ? 2 : 1, y: 1})
        this.state = state ?? {switches: 0}
        this.nsw = 4
        if (opts.n) {
            this.nsw = opts.n
        }
        this.el.modCont.appendChild(this.#genUI())
    }

    reset() {
        // do nothing
    }

    callbacks = [(rw, data, addr) => {
        if (rw == "r") {
            return this.state.switches
        }
    }]
    
    updateUI(force) {
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
                }},
                    after: e => {
                        if(this.state.switches & (1 << i)) {
                            e.checked = true;
                        }
                    }
                }),
            )
        }
        return g("div", {klass: "swCont"}, this.sws)
    }
}

class StackMod extends SimMod {
    static title = "Stack"
    static opts = [
        {op: "size", type: "number", val: 32, min: 1, max: 128, desc: "Size"}
    ]

    constructor(opts, callbacks, state) {
        super("Stack", callbacks, true, [
            {addr: "3", rw: "rw", desc: "Push/Pop"},
            {addr: "4", rw: "r", desc: "Length"}
        ], 
            {x: 1, y: Math.ceil(opts.size / 2 * 18 / 100) + 1}
        )
        this.size = opts.size
        this.state = state ?? {stack: []}
        this.updateReq = false
        this.el.modCont.appendChild(this.#genUI())
    }

    reset() {
        this.state = {stack: []}
        this.updateReq = true
    }

    callbacks = [
        (rw, data, addr) => {
            if (rw == "r") {
                const e = this.state.stack.pop()
                this.updateReq = true
                if (e === undefined) {
                    this.interrupt()
                    return 0
                }
                return e
            }
            if (rw == "w") {
                if (this.state.stack.length < this.size) {
                    this.state.stack.push(data)
                    this.updateReq = true
                } else {
                    this.interrupt()
                }
            }
        },
        (rw, data, addr) => {
            if (rw == "r") {
                return this.state.stack.length
            }
        }
    ]

    updateUI(force) {
        if (!this.updateReq && !force) {
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
                o.push(g("div", {innerText: "0", after: e => this.el.stack.push(e)}))
            }
            return o
        }

        return g("div", {klass: "stackCon"}, [
            g("div", {klass: "stackHeader"}, [
                g("span", {innerText: "Length: "}),
                g("span", {innerText: "0", after: e => this.el.lenEl = e})
            ]),
            g("div", {klass: ["twoCol", "stackContent"], style: `--stackH: ${this.size / 2}`}, genList())
        ])
    }
}

class MemMapMod extends SimMod {
    static title = "MemMap"
    static opts = [
        {op: "size", type: "number", val: 8, min: 1, max: 128, desc: "Size"}
    ]

    constructor(opts, callbacks, state) {
        super("MemMap", callbacks, false, [
            {addr: `8-${7 + opts.size}`, rw: "rw", desc: "Data"}
        ], {x: 1, y: Math.ceil(opts.size / 2 * 18 / 100) + 1})
        this.size = opts.size
        this.state = state ?? {data: Array(this.size).fill(0)}
        this.el.modCont.appendChild(this.#genUI())
    }

    reset() {
        this.state = {data: Array(this.size).fill(0)}
        this.updateReq = true
    }

    callbacks = [(rw, data, addr) => {
        if (rw == "r") {
            return this.state.data[addr % this.size]
        }
        if (rw == "w") {
            this.state.data[addr % this.size] = data
            this.updateReq = true
        }
    }]

    updateUI(force) {
        if (!this.updateReq && !force) {
            return
        }
        for (let i = 0; i < this.size; i++) {
            this.el.dvals[i].innerText = this.state.data[i]
        }
        this.updateReq = false
    }

    #genUI() {
        const g = SimUI.htmlGen.bind(this)
        this.el.dvals = []
        
        const genList = () => {
            const o = []
            for (let i = 0; i < this.size; i++) {
                o.push(g("div", {}, [
                    g("div", {innerText: `${i}`}),
                    g("div", {innerText: "0", after: e => this.el.dvals[i] = e})
                ]))
            }
            return o
        }
        return g("div", {klass: "twoCol", style: `--stackH: ${this.size / 2}`}, genList())
    }
}


class ParLCDMod extends SimMod {
    static title = "ParLCD"
    static opts = []

    static rendS = {
        margin: 8,
        pixel: 4,
        ppdist: 1,
        ccdist: 2
    }
    static colors = {
        "pset": "#263305",
        "pixl": "#64860E",
        "char": "#6B8F0F",
        "back": "#8CBA14"
    }
    static crom = {
        0x21: [ 4, 4, 4, 4, 0, 0, 4, 0],
        0x22: [10,10,10, 0, 0, 0, 0, 0],
        0x23: [10,10,31,10,31,10,10, 0],
        0x24: [ 4,15,20,14, 5,30, 4, 0],
        0x25: [24,25, 2, 4, 8,19, 3, 0],
        0x26: [12,18,20, 8,21,18,13, 0],
        0x27: [12, 4, 8, 0, 0, 0, 0, 0],
        0x28: [ 2, 4, 8, 8, 8, 4, 2, 0],
        0x29: [ 8, 4, 2, 2, 2, 4, 8, 0],
        0x2A: [ 0, 4,21,14,21, 4, 0, 0],
        0x2B: [ 0, 4, 4,31, 4, 4, 0, 0],
        0x2C: [ 0, 0, 0, 0,12, 4, 8, 0],
        0x2D: [ 0, 0, 0,31, 0, 0, 0, 0],
        0x2E: [ 0, 0, 0, 0, 0,12,12, 0],
        0x2F: [ 0, 1, 2, 4, 8,16, 0, 0],
        0x30: [14,17,19,21,25,17,14, 0],
        0x31: [ 4,12, 4, 4, 4, 4,14, 0],
        0x32: [14,17, 1, 2, 4, 8,31, 0],
        0x33: [31, 2, 4, 2, 1,17,14, 0],
        0x34: [ 2, 6,10,18,31, 2, 2, 0],
        0x35: [31,16,30, 1, 1,17,14, 0],
        0x36: [ 6, 8,16,30,17,17,14, 0],
        0x37: [31, 1, 2, 4, 8, 8, 8, 0],
        0x38: [14,17,17,14,17,17,14, 0],
        0x39: [14,17,17,15, 1, 2,12, 0],
        0x3A: [ 0,12,12, 0,12,12, 0, 0],
        0x3B: [ 0,12,12, 0,12, 4, 8, 0],
        0x3C: [ 2, 4, 8,16, 8, 4, 2, 0],
        0x3D: [ 0, 0,31, 0,31, 0, 0, 0],
        0x3E: [ 8, 4, 2, 1, 2, 4, 8, 0],
        0x3F: [14,17, 1, 2, 4, 0, 4, 0],
        0x40: [14,17, 1,13,21,21,14, 0],
        0x41: [14,17,17,17,31,17,17, 0],
        0x42: [30,17,17,30,17,17,30, 0],
        0x43: [14,17,16,16,16,17,14, 0],
        0x44: [28,18,17,17,17,18,28, 0],
        0x45: [31,16,16,30,16,16,31, 0],
        0x46: [31,16,16,30,16,16,16, 0],
        0x47: [14,17,16,23,17,17,15, 0],
        0x48: [17,17,17,31,17,17,17, 0],
        0x49: [14, 4, 4, 4, 4, 4,14, 0],
        0x4A: [ 7, 2, 2, 2, 2,18,12, 0],
        0x4B: [17,18,20,24,20,18,17, 0],
        0x4C: [16,16,16,16,16,16,31, 0],
        0x4D: [17,27,21,21,17,17,17, 0],
        0x4E: [17,17,25,21,19,17,17, 0],
        0x4F: [14,17,17,17,17,17,14, 0],
        0x50: [30,17,17,30,16,16,16, 0],
        0x51: [14,17,17,17,21,18,13, 0],
        0x52: [30,17,17,30,20,18,17, 0],
        0x53: [15,16,16,14, 1, 1,30, 0],
        0x54: [31, 4, 4, 4, 4, 4, 4, 0],
        0x55: [17,17,17,17,17,17,14, 0],
        0x56: [17,17,17,17,17,10, 4, 0],
        0x57: [17,17,17,21,21,21,10, 0],
        0x58: [17,17,10, 4,10,17,17, 0],
        0x59: [17,17,17,10, 4, 4, 4, 0],
        0x5A: [31, 1, 2, 4, 8,16,31, 0],
        0x5B: [14, 8, 8, 8, 8, 8,14, 0],
        0x5C: [17,10,31, 4,31, 4, 4, 0],
        0x5D: [14, 2, 2, 2, 2, 2,14, 0],
        0x5E: [ 4,10,17, 0, 0, 0, 0, 0],
        0x5F: [ 0, 0, 0, 0, 0, 0,31, 0],
        0x60: [ 8, 4, 2, 0, 0, 0, 0, 0],
        0x61: [ 0, 0,14, 1,15,17,15, 0],
        0x62: [16,16,22,25,17,17,30, 0],
        0x63: [ 0, 0,14,16,16,17,14, 0],
        0x64: [ 1, 1,13,19,17,17,15, 0],
        0x65: [ 0, 0,14,17,31,16,14, 0],
        0x66: [ 6, 9, 8,28, 8, 8, 8, 0],
        0x67: [ 0,15,17,17,15, 1,14, 0],
        0x68: [16,16,22,25,17,17,17, 0],
        0x69: [ 4, 0,12, 4, 4, 4,14, 0],
        0x6A: [ 2, 0, 6, 2, 2,18,12, 0],
        0x6B: [16,16,18,20,24,20,18, 0],
        0x6C: [12, 4, 4, 4, 4, 4,14, 0],
        0x6D: [ 0, 0,26,21,21,17,17, 0],
        0x6E: [ 0, 0,22,25,17,17,17, 0],
        0x6F: [ 0, 0,14,17,17,17,14, 0],
        0x70: [ 0, 0,30,17,30,16,16, 0],
        0x71: [ 0, 0,13,19,15, 1, 1, 0],
        0x72: [ 0, 0,22,25,16,16,16, 0],
        0x73: [ 0, 0,14,16,14, 1,30, 0],
        0x74: [ 8, 8,28, 8, 8, 9, 6, 0],
        0x75: [ 0, 0,17,17,17,19,13, 0],
        0x76: [ 0, 0,17,17,17,10, 4, 0],
        0x77: [ 0, 0,17,17,21,21,10, 0],
        0x78: [ 0, 0,17,10, 4,10,17, 0],
        0x79: [ 0, 0,17,17,15, 1,14, 0],
        0x7A: [ 0, 0,31, 2, 4, 8,31, 0],
        0x7B: [ 2, 4, 4, 8, 4, 4, 2, 0],
        0x7C: [ 4, 4, 4, 4, 4, 4, 4, 0],
        0x7D: [ 8, 4, 4, 2, 4, 4, 8, 0],
        0x7E: [ 0, 4, 2,31, 2, 4, 0, 0],
        0x7F: [ 0, 4, 8,31, 8, 4, 0, 0],
        0xA1: [ 0, 0, 0, 0,28,20,28, 0],
        0xA2: [ 7, 4, 4, 4, 0, 0, 0, 0],
        0xA3: [ 0, 0, 0, 4, 4, 4,28, 0],
        0xA4: [ 0, 0, 0, 0,16, 8, 4, 0],
        0xA5: [ 0, 0, 0,12,12, 0, 0, 0],
        0xA6: [ 0,31, 1,31, 1, 2, 4, 0],
        0xA7: [ 0, 0,31, 1, 6, 4, 8, 0],
        0xA8: [ 0, 0, 2, 4,12,20, 4, 0],
        0xA9: [ 0, 0, 4,31,17, 1, 6, 0],
        0xAA: [ 0, 0, 0,31, 4, 4,31, 0],
        0xAB: [ 0, 0, 2,31, 6,10,18, 0],
        0xAC: [ 0, 0, 8,31, 9,10, 8, 0],
        0xAD: [ 0, 0, 0,14, 2, 2,31, 0],
        0xAE: [ 0, 0,30, 2,30, 2,30, 0],
        0xAF: [ 0, 0, 0,21,21, 1, 6, 0],
        0xB0: [ 0, 0, 0,31, 0, 0, 0, 0],
        0xB1: [31, 1, 5, 6, 4, 4, 8, 0],
        0xB2: [ 1, 2, 4,12,20, 4, 4, 0],
        0xB3: [ 4,31,17,17, 1, 2, 4, 0],
        0xB4: [ 0,31, 4, 4, 4, 4,31, 0],
        0xB5: [ 2,31, 2, 6,10,18, 2, 0],
        0xB6: [ 8,31, 9, 9, 9, 9,18, 0],
        0xB7: [ 4,31, 4,31, 4, 4, 4, 0],
        0xB8: [ 0,15, 9,17, 1, 2,12, 0],
        0xB9: [ 8,15,18, 2, 2, 2, 4, 0],
        0xBA: [ 0,31, 1, 1, 1, 1,31, 0],
        0xBB: [10,31,10,10, 2, 4, 8, 0],
        0xBC: [ 0,24, 1,25, 1, 2,28, 0],
        0xBD: [ 0,31, 1, 2, 4,10,17, 0],
        0xBE: [ 8,31, 9,10, 8, 8, 7, 0],
        0xBF: [ 0,17,17, 9, 1, 2,12, 0],
        0xC0: [ 0,15, 9,21, 3, 2,12, 0],
        0xC1: [ 2,28, 4,31, 4, 4, 8, 0],
        0xC2: [ 0,21,21,21, 1, 2, 4, 0],
        0xC3: [14, 0,31, 4, 4, 4, 8, 0],
        0xC4: [ 8, 8, 8,12,10, 8, 8, 0],
        0xC5: [ 4, 4,31, 4, 4, 8,16, 0],
        0xC6: [ 0,14, 0, 0, 0, 0,31, 0],
        0xC7: [ 0,31, 1,10, 4,10,16, 0],
        0xC8: [ 4,31, 2, 4,14,21, 4, 0],
        0xC9: [ 2, 2, 2, 2, 2, 4, 8, 0],
        0xCA: [ 0, 4, 2,17,17,17,17, 0],
        0xCB: [16,16,31,16,16,16,15, 0],
        0xCC: [ 0,31, 1, 1, 1, 2,12, 0],
        0xCD: [ 0, 8,20, 2, 1, 1, 0, 0],
        0xCE: [ 4,31, 4, 4,21,21, 4, 0],
        0xCF: [ 0,31, 1, 1,10, 4, 2, 0],
        0xD0: [ 0,14, 0,14, 0,14, 1, 0],
        0xD1: [ 0, 4, 8,16,17,31, 1, 0],
        0xD2: [ 0, 1, 1,10, 4,10,16, 0],
        0xD3: [ 0,31, 8,31, 8, 8, 7, 0],
        0xD4: [ 8, 8,31, 9,10, 8, 8, 0],
        0xD5: [ 0,14, 2, 2, 2, 2,31, 0],
        0xD6: [ 0,31, 1,31, 1, 1,31, 0],
        0xD7: [14, 0,31, 1, 1, 2, 4, 0],
        0xD8: [18,18,18,18, 2, 4, 8, 0],
        0xD9: [ 0, 4,20,20,21,21,22, 0],
        0xDA: [ 0,16,16,17,18,20,24, 0],
        0xDB: [ 0,31,17,17,17,17,31, 0],
        0xDC: [ 0,31,17,17, 1, 2, 4, 0],
        0xDD: [ 0,24, 0, 1, 1, 2,28, 0],
        0xDE: [ 4,18, 8, 0, 0, 0, 0, 0], 
        0xDF: [28,20,28, 0, 0, 0, 0, 0],
        0xE0: [ 0, 0, 9,21,18,18,13, 0],
        0xE1: [10, 0,14, 1,15,17,15, 0],
        0xE2: [ 0, 0,14,17,30,17,30,16,16,16],
        0xE3: [ 0, 0,14,16,12,17,14, 0],
        0xE4: [ 0, 0,17,17,17,19,29,16,16,16],
        0xE5: [ 0, 0,15,20,18,17,14, 0],
        0xE6: [ 0, 0, 6, 9,17,17,30,16,16,16],
        0xE7: [ 0, 0,15,17,17,17,15, 1, 1,14],
        0xE8: [ 0, 0, 7, 4, 4,20, 8, 0],
        0xE9: [ 0, 2,26, 2, 0, 0, 0, 0],
        0xEA: [ 2, 0, 6, 2, 2, 2, 2, 2,18,12],
        0xEB: [ 0,20, 8,20, 0, 0, 0, 0],
        0xEC: [ 0, 4,14,20,21,14, 4, 0],
        0xED: [ 8, 8,28, 8,28, 8,15, 0],
        0xEE: [14, 0,22,25,17,17,17, 0],
        0xEF: [10, 0,14,17,17,17,14, 0],
        0xF0: [ 0, 0,22,25,17,17,30,16,16,16],
        0xF1: [ 0, 0,13,19,17,17,15, 1, 1, 1],
        0xF2: [ 0,14,17,31,17,17,14, 0],
        0xF3: [ 0, 0, 0,11,21,26, 0, 0],
        0xF4: [ 0, 0,14,17,17,10,27, 0],
        0xF5: [10, 0,17,17,17,19,13, 0],
        0xF6: [31,16, 8, 4, 8,16,31, 0],
        0xF7: [ 0, 0,31,10,10,10,19, 0],
        0xF8: [31, 0,17,10, 4,10,17, 0],
        0xF9: [ 0, 0,17,17,17,17,15, 1, 1,14],
        0xFA: [ 0, 1,30, 4,31, 4, 4, 0],
        0xFB: [ 0, 0,31, 8,15, 9,17, 0],
        0xFC: [ 0, 0,31,21,31,17,17, 0],
        0xFD: [ 0, 0, 4, 0,31, 0, 4, 0],
        0xFF: [31,31,31,31,31,31,31,31,31,31],
    }

    static rchar = {}
    rchar = {}
    blinktimer = null
    blinkstate = false

    constructor(opts, callbacks, state) {
        super("ParLCD", callbacks, false, [
            {addr: "5", rw: "w", desc: "Cntrl Reg"},
            {addr: "6", rw: "w", desc: "Data Reg"}
        ], {x: 2, y: 2})
        this.updateReq = true
        const s = ParLCDMod.rendS
        s.cwidth = 2 * s.margin + 16 * 5 * s.pixel + 15 * s.ccdist + 16 * 4 * s.ppdist
        s.cheight = 2 * s.margin + 2 * 8 * s.pixel + s.ccdist + 2 * 7 * s.ppdist
        if(state) {
            this.state = state
            if (state.BONOFF) {
                this.#setCursorBlink(true)
            }
        } else {
            this.reset()
        }
        this.el.modCont.appendChild(this.#genUI())
        this.renderHC()
    }

    reset() {
        this.state = {
            cram: new Array(8).fill(0).map(e => new Array(8).fill(e)), 
            dram: new Array(128).fill(0x20),
            AC: 0,
            ID: true,
            SH: false,
            shift: 0,
            DONOFF: false,
            CONOFF: false,
            BONOFF: false,
            curaddr: false // 0: data 1: cdata
        }
        this.#setCursorBlink(false)
        this.updateReq = true
        this.rchar = {}
    }

    #setCursorBlink(v) {
        if(v) {
            this.state.BONOFF = true
            if (!this.blinktimer) {
                this.blinktimer = setInterval(e => {
                    this.blinkstate = !this.blinkstate
                    this.updateReq = true
                }, 500)
            }
            this.updateHand.reqUpdate(this, true)
        } else {
            this.state.BONOFF = false
            if (this.blinktimer) {
                clearInterval(this.blinktimer)
                this.blinktimer = null
                this.blinkstate = false
            }
            this.updateHand.reqUpdate(this, false)
        }
    }

    callbacks = [
        (rw, data, addr) => {
            if(data === 1) { // Clear display
                this.state.dram.fill(0x20)
                this.state.AC = 0
                this.state.ID = true
                this.state.shift = 0
                this.state.curaddr = false
            } else if(data & 0xFE === 2) { // Return home
                this.state.AC = 0
                this.state.shift = 0
                this.state.curaddr = false
            } else if((data >> 2) === 1) { // Entry mode set
                this.state.ID = !!(data & 2)
                this.state.SH = !!(data & 1)
            } else if((data >> 3) === 1) { // Display ON/OFF control
                this.state.DONOFF = !!(data & 4)
                this.state.CONOFF = !!(data & 2)
                this.#setCursorBlink(!!(data & 1))
            } else if((data >> 4) === 1) { // Cursor or Display Shift
                if(data & 8) { // Display shift
                    this.state.shift += data & 4 ? 1 : -1
                } else { // Cursor shift
                    this.state.AC += data & 4 ? 1 : -1
                }
            } else if((data >> 5) === 1) { // Function Set
                // Not implemented (yet?)
            } else if((data >> 6) === 1) { // Set CGRAM Address
                this.state.curaddr = true
                this.state.AC = data & 0x3F
            } else if((data >> 7) === 1) { // Set DDRAM Address
                this.state.curaddr = false
                this.state.AC = data & 0x7F
            }
            this.updateReq = true
        },
        (rw, data, addr) => {
            if (this.state.curaddr) {
                this.state.cram[this.state.AC >> 3][this.state.AC & 7] = data
                delete this.rchar[this.state.AC >> 3]
                delete this.rchar[(this.state.AC >> 3) + 8]
                this.state.AC += this.state.ID ? 1 : -1
                if (this.state.AC > 63) {
                    this.state.AC = 0
                } else if (this.state.AC < 0) {
                    this.state.AC = 63
                }
            } else {
                this.state.dram[this.state.AC] = data
                this.state.AC += this.state.ID ? 1 : -1
                if(this.state.SH) {
                    this.state.shift += this.state.ID ? 1 : -1
                }
                if(this.state.AC > 127) {
                    this.state.AC = 0
                } else if(this.state.AC < 0) {
                    this.state.AC = 127
                }
            }
            this.updateReq = true
        }
    ]

    renderHC() {
        const s = ParLCDMod.rendS
        const ctx = this.el.hc.getContext("2d")
        ctx.fillStyle = ParLCDMod.colors.back
        ctx.fillRect(0, 0, s.cwidth, s.cheight);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 16; j++) {
                ctx.fillStyle = ParLCDMod.colors.char
                const bx = s.margin + j * (s.pixel * 5 + s.ppdist * 4 + s.ccdist)
                const by = s.margin + i * (s.pixel * 8 + s.ppdist * 7 + s.ccdist)
                ctx.fillRect(bx, by,
                    5 * s.pixel + 4 * s.ppdist,
                    8 * s.pixel + 7 * s.ppdist
                )
                ctx.fillStyle = ParLCDMod.colors.pixl
                for (let k = 0; k < 8; k++) {
                    for (let l = 0; l < 5; l++) {
                        ctx.fillRect(
                            bx + l * (s.pixel + s.ppdist),
                            by + k * (s.pixel + s.ppdist),
                            s.pixel, s.pixel
                        )
                    }
                }
            }
        }

        this.ctx = this.el.c.getContext("2d")
        this.ctx.drawImage(this.el.hc, 0, 0);
    }

    rendChar(cc) {
        if (cc <= 0xF) {
            cc = cc & 0b111
        } else if (ParLCDMod.rchar[cc]) {
            this.rchar[cc] = ParLCDMod.rchar[cc]
            return
        }
        const s = ParLCDMod.rendS
        const cnv = document.createElement("canvas")
        const cw = 5 * s.pixel + 4 * s.ppdist
        const ch = 8 * s.pixel + 7 * s.ppdist
        let crdat = cc > 0b111 ? ParLCDMod.crom[cc] : this.state.cram[cc]
        crdat ??= new Array(8).fill(0)
        cnv.width = cw
        cnv.height = ch
        const ctx = cnv.getContext("2d")
        ctx.fillStyle = ParLCDMod.colors.char
        ctx.fillRect(0, 0, cw, ch)
        for (let i = 0; i < 8; i++) {
            let ccrow = crdat[i]
            for (let j = 0; j < 5; j++) {
                ctx.fillStyle = ccrow & 0x10 ? ParLCDMod.colors.pset : ParLCDMod.colors.pixl
                ccrow <<= 1
                ctx.fillRect(
                    j * (s.pixel + s.ppdist),
                    i * (s.pixel + s.ppdist),
                    s.pixel, s.pixel
                )
            }
        }
        this.rchar[cc] = cnv
        if (cc > 0xF) {
            ParLCDMod.rchar[cc] = cnv
        } else {
            this.rchar[cc + 8] = cnv
        }
    }

    writeChar(x, y, cc) {
        const ctx = this.ctx
        const s = ParLCDMod.rendS
        if(!this.rchar[cc]) {
            this.rendChar(cc)
        }
        ctx.drawImage(this.rchar[cc],
            s.margin + x * (5 * s.pixel + 4 * s.ppdist + s.ccdist),
            s.margin + y * (8 * s.pixel + 7 * s.ppdist + s.ccdist)
        )
    }

    updateUI(force) {
        if (!this.updateReq && !force) {
            return
        }
        const ctx = this.ctx
        ctx.drawImage(this.el.hc, 0, 0);
        if (!this.state.DONOFF) {
            return
        }
        for (let i = 0; i < 16; i++) {
            this.writeChar(i, 0, this.state.dram[i + this.state.shift])
        }
        for (let i = 0; i < 16; i++) {
            this.writeChar(i, 1, this.state.dram[0x40 + i + this.state.shift])
        }
        if(this.state.CONOFF && !this.state.curaddr && (!this.state.BONOFF || this.blinkstate)) {
            if (this.state.AC < 16) {
                this.writeChar(this.state.AC, 0, 0xFF)
            } else if (this.state.AC >= 0x40 && this.state.AC < 0x50) {
                this.writeChar(this.state.AC - 0x40, 1, 0xFF)
            }
        }
        this.updateReq = false
    }


    #genUI() {
        const g = SimUI.htmlGen.bind(this)
        return g("div", {klass: "lcdCont"}, [
            g("canvas", {after: e => {this.el.c = e}, attr: {
            width: `${ParLCDMod.rendS.cwidth}`, height: `${ParLCDMod.rendS.cheight}`
        }}),
            g("canvas", {after: e => {this.el.hc = e}, attr: {
                hidden: "", width: `${ParLCDMod.rendS.cwidth}`, height: `${ParLCDMod.rendS.cheight}`
            }})
        
        ])
    }
}


class KeyboardMod extends SimMod {
    static title = "Keyboard"
    static opts = []

    autosTO = null;
    pressedKeys = new Set()

    constructor(opts, callbacks, state) {
        super("Keyboard", callbacks, true, [
            {addr: `10`, rw: "r", desc: "Scancode"}
        ], {x: 2, y: 2})
        this.size = opts.size
        if(state) {
            this.state = state
        } else {
            this.state = {
                capS: false,
                capKD: false,
                capKU: false,
                eventq: [[0, "Default value"]],
                asnd: false,
                asdel: 500,
                repeat: false
            }
        }
        this.el.modCont.appendChild(this.#genUI())
        if (this.state.asnd) {
            this.#autoSend()
        }
        document.addEventListener('keydown', this.kdel = (e => {
            if (this.state.capKD) {
                e.preventDefault()
                if (!this.state.repeat && this.pressedKeys.has(e.code)) {
                    return
                }
                if (this.state.capS) {
                    this.el.capKD.checked = false
                    this.state.capKD = false
                }
                const scancode = KeyboardMod.getkkseq(e.code, true);
                if (scancode.length !== 0) {
                    this.#addCodes(scancode, e.key)
                    this.updateReq = true
                    if(this.state.asnd) {
                        this.#autoSend(true)
                    } else {
                        this.updateHand.reqUpdate(this, false, true)
                    }
                }
            }
            this.pressedKeys.add(e.code)
        }), true);
        document.addEventListener('keyup', this.kuel = (e => {
            if (this.state.capKU) {
                e.preventDefault()
                if(this.state.capS) {
                    this.el.capKU.checked = false
                    this.state.capKU = false
                }
                const scancode = KeyboardMod.getkkseq(e.code, false);
                if (scancode.length !== 0) {
                    this.#addCodes(scancode, e.key)
                    this.updateReq = true
                    if(this.state.asnd) {
                        this.#autoSend(true)
                    } else {
                        this.updateHand.reqUpdate(this, false, true)
                    }
                }
            }
            this.pressedKeys.delete(e.code)
        }), true);
    }

    #addCodes(cc, nm) {
        if (this.state.eventq.length >= 100) {
            return
        }
        if (nm.length === 1) nm = nm.toLowerCase()
        for (const [i, e] of cc.entries()) {
            if (e === 0xF0) {
                this.state.eventq.push([e, "Breakcode"])
            } else if(e === 0xE0) {
                this.state.eventq.push([e, "Extended"])
            } else if(i === cc.length - 1) {
                this.state.eventq.push([e, nm])
            } else {
                this.state.eventq.push([e, ""])
            }
        }
    }

    delete() {
        document.removeEventListener("keydown", this.kdel, true)
        document.removeEventListener("keyup", this.kuel, true)
        super.delete()
    }

    reset() {
        this.state.eventq = [[0, "Default value"]]
        this.state.actVal = 0
        this.updateReq = true
    }

    callbacks = [(rw, data, addr) => {
        return this.state.eventq[0][0]
    }]

    #autoSend(upd) {
        if(!this.autosTO && this.state.eventq.length > 1 && this.state.asnd) {
            this.#sendEvent()
            this.updateHand.reqUpdate(this, false, true)
            this.autosTO = setTimeout(e => {
                this.autosTO = null
                this.#autoSend(false)
            }, this.state.asdel)
        } else if (upd) {
            this.updateHand.reqUpdate(this, false, true)
        }
    }

    #sendEvent() {
        if (this.state.eventq.length === 1) {
            return
        }
        this.state.eventq.shift()
        this.interrupt()
        this.updateReq = true
        this.updateHand.reqUpdate(this, false, true)
    }

    updateUI(force) {
        if (!this.updateReq && !force) {
            return
        }
        const wEvents = Math.min(this.el.qEls.length, this.state.eventq.length)
        for (const [i, e] of this.el.qEls.slice(0, wEvents).entries()
        ) {
            e.children[0].innerText = this.state.eventq[i][0].toString(16).toUpperCase()
            e.children[1].innerText = this.state.eventq[i][1]
        }
        for (const e of this.el.qEls.slice(wEvents)) {
            e.children[0].innerText = " "
            e.children[1].innerText = " "
        }
        this.el.mansbtn.disabled = this.state.eventq.length === 1
        this.updateReq = false
    }

    #genUI() {
        const g = SimUI.htmlGen.bind(this)
        return g("div", {klass: "KBModCont"}, [
            g("div", {}, [
                ...(() => {
                    const o = []
                for (const t of [
                    ["capS", "Single mode"],
                    ["capKD", "Capture keydown"],
                    ["capKU", "Capture keyup"],
                ]) {
                    o.push(g("div", {}, [
                        g("input", {type: "checkbox", event: {change: (e) => {
                            this.state[t[0]] = e.target.checked
                        }}, after: e => {
                            this.el[t[0]] = e
                            e.checked = this.state[t[0]]
                        }}),
                        g("span", {innerText: t[1]}),
                    ]))
                }
                return o
            })(),
            g("div", {}, [
                g("input", {type: "checkbox", event: {change: (e) => {
                    this.state.asnd = e.target.checked
                    this.#autoSend()
                }}, after: e => {
                    e.checked = this.state.asnd
                }}),
                g("span", {innerText: "Autosend  "}),
                g("input", {type: "number", event: {change: (e) => {
                    this.state.asdel = parseInt(e.target.value)
                }}, after: e => {
                    e.value = this.state.asdel
                }})
            ]),
            g("div", {}, [
                g("input", {type: "checkbox", event: {change: (e) => {
                    this.state.repeat = e.target.checked
                }}, after: e => {
                    e.checked = this.state.repeat
                }}),
                g("span", {innerText: "Repeat"})
            ]),
            g("div", {}, [
                g("input", {type: "button", value: "Manual Send", event: e => {
                    this.#sendEvent()
                }, after: e => {
                    this.el.mansbtn = e
                    e.disabled = this.state.eventq.length === 1
                }}),
                g("input", {type: "button", value: "Reset queue", event: e => {
                    this.state.eventq = [[0, "Default value"]]
                    this.updateReq = true
                    this.updateHand.reqUpdate(this, false, true)
                }})
            ])
        ]), g("div", {}, [
            g("div", {innerText: "Event queue:"}),
            g("div", {klass: "queueCont"},
                (() => {
                    this.el.qEls = []
                    for (let i = 0; i < 5; i++) {
                        this.el.qEls[i] = g("div", {}, [g("div"), g("div")])
                    }
                    return this.el.qEls
                })())
            ])
        ])
    }


    static getkkseq(ec, make) {
        const el = this.keyCodeToScanCode[ec]
        if(el === undefined) {
            return []
        }
        if (!Array.isArray(el)) {
            return make ? [el] : [0xF0, el]
        }
        if(!Array.isArray(el[0])) {
            return make ? el : 
                [...el.slice(0, -1), 0xF0, el.at(-1)]
        }
        return make ? el[0] : el[1]
    }

    static keyCodeToScanCode = {
        "Escape": 0x76,
        "F1": 0x05,
        "F2": 0x06,
        "F3": 0x04,
        "F4": 0x0C,
        "F5": 0x03,
        "F6": 0x0B,
        "F7": 0x83,
        "F8": 0x0A,
        "F9": 0x01,
        "F10": 0x09,
        "F11": 0x78,
        "F12": 0x07,
        // Prt Scr not captured
        "ScrollLock": 0x7E,
        "Pause": [[0xE1, 0x14, 0x77, 0xE1, 0xF0, 0x14, 0xE0, 0x77], []],
        "Backquote": 0x0E,
        "Digit1": 0x16,
        "Digit2": 0x1E,
        "Digit3": 0x26,
        "Digit4": 0x25,
        "Digit5": 0x2E,
        "Digit6": 0x36,
        "Digit7": 0x3D,
        "Digit8": 0x3E,
        "Digit9": 0x46,
        "Digit0": 0x45,
        "Minus": 0x4E,
        "Equal": 0x55,
        "Backspace": 0x66,
        "Tab": 0x0D,
        "KeyQ": 0x15,
        "KeyW": 0x1D,
        "KeyE": 0x24,
        "KeyR": 0x2D,
        "KeyT": 0x2C,
        "KeyY": 0x35,
        "KeyU": 0x3C,
        "KeyI": 0x43,
        "KeyO": 0x44,
        "KeyP": 0x4D,
        "BracketLeft": 0x54,
        "BracketRight": 0x5B,
        "Backslash": 0x5D,
        "CapsLock": 0x58,
        "KeyA": 0x1C,
        "KeyS": 0x1B,
        "KeyD": 0x23,
        "KeyF": 0x2B,
        "KeyG": 0x34,
        "KeyH": 0x33,
        "KeyJ": 0x3B,
        "KeyK": 0x42,
        "KeyL": 0x4B,
        "Semicolon": 0x4C,
        "Quote": 0x52,
        "Enter": 0x5A,
        "ShiftLeft": 0x12,
        "KeyZ": 0x1A,
        "KeyX": 0x22,
        "KeyC": 0x21,
        "KeyV": 0x2A,
        "KeyB": 0x32,
        "KeyN": 0x31,
        "KeyM": 0x3A,
        "Comma": 0x41,
        "Period": 0x49,
        "Slash": 0x4A,
        "ShiftRight": 0x59,
        "ControlLeft": 0x14,
        "MetaLeft": [0xE0, 0x1F],
        "AltLeft": 0x11,
        "Space": 0x29,
        "AltRight": [0xE0, 0x11],
        "MetaRight": [0xE0, 0x27],
        "ContextMenu": [0xE0, 0x2F],
        "ControlRight": [0xE0, 0x14],
        "Insert": [0xE0, 0x70],
        "Home": [0xE0, 0x6C],
        "PageUp": [0xE0, 0x7D],
        "Delete": [0xE0, 0x71],
        "End": [0xE0, 0x69],
        "PageDown": [0xE0, 0x7A],
        "ArrowUp": [0xE0, 0x75],
        "ArrowLeft": [0xE0, 0x6B],
        "ArrowDown": [0xE0, 0x72],
        "ArrowRight": [0xE0, 0x74],
        "NumLock": 0x77,
        "NumpadDivide": [0xE0, 0x4A],
        "NumpadMultiply": 0x7C,
        "NumpadSubtract": 0x7B,
        "Numpad7": 0x6C,
        "Numpad8": 0x75,
        "Numpad9": 0x7D,
        "NumpadAdd": 0x79,
        "Numpad4": 0x6B,
        "Numpad5": 0x73,
        "Numpad6": 0x74,
        "Numpad1": 0x69,
        "Numpad2": 0x72,
        "Numpad3": 0x7A,
        "Numpad0": 0x70,
        "NumpadDecimal": 0x71,
        "NumpadEnter": [0xE0, 0x5A]
    }
}
