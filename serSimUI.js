"use strict";


class serSimUI extends SimUI {    
    constructor(parentElement, prog) {
        super(parentElement, prog)
        this.cpustate = {
            pmem: prog.bytecode,
            dmem: new Array(64).fill(0),
            stack: new Array(32).fill(0),
            reg: new Array(16).fill(0),
            PC: 0,
            ZF: false,
            CF: false,
            intEn: false,
            intrq: false
        }
        this.ser = {
            port: undefined,
            reader: undefined,
            writer: undefined,
            buff: "",
            recProm: undefined,
            lock: false,
            reqq: []
        }
        this.dataPullIntid = undefined
        this.genUI()
        this.updateUI()
    }



    replaceCode(prog) {
        super.replaceCode(prog)
        this.cpustate.pmem = this.prog.bytecode
        this.genUI()
        this.updateUI()
        if(this.ser.port) {
            setTimeout(this.sendBPs.bind(this), 0)
        }
    }

    async reset() {
        if(this.ser.port) {
            super.reset()
            await this.comVal('w', 0, 4)
            await this.updateState()
        }
    }

    async step() {
        if(!this.running && this.ser.port) {
            await this.comVal('w', 0, 2)
            await this.updateState()
            this.scrollIntoView(this.cpustate)
        }
    }
    
    async trigInt() {
        if(this.ser.port) {
            await this.comVal('w', 0, 3)
            if (!this.running) {
                this.updateState()
            }
        }
    }

    bpchange() {
        if(this.ser.port) {
            setTimeout(this.sendBPs.bind(this), 0)
        }
    }

    async processMod(r, v) {
        let tar, ind
        if (Array.isArray(r)) {
            tar = r[0]
            ind = r[1]
        } else {
            tar = r
            ind = 0
        }
        const b = (v) => {
            v = v.toLowerCase()
            return ["t", "true", "1"].includes(v)
        }
        const c = this.comVal.bind(this)
        const s = this.cpustate
        switch (tar) {
            case "PC":    await c('w', 0x2000, parseInt(v))                     ; break
            case "ZF":    await c('w', 0x2001, b(v) | s.CF << 1 | s.intEn << 2) ; break
            case "CF":    await c('w', 0x2001, b(v) << 1 | s.ZF | s.intEn << 2) ; break
            case "intEn": await c('w', 0x2001, b(v) << 2 | s.ZF | s.CF << 1)    ; break
            case "intRq": /* do nothing*/                                       ; break
            case "reg":   await c('w', 0x3000 + ind, parseInt(v)) ; break
            case "dmem":  await c('w', 0x4000 + ind, parseInt(v)) ; break
            case "stack": await c('w', 0x2010 + ind, parseInt(v)) ; break
            default: break;
        }
        this.updateState()
    }

    async run(state) {
        if (this.running === state) {
            return
        }
        this.running = !this.running
        if (this.running) {
            await this.comVal('w', 0, 1)
            if (!this.dataPullIntid) {
                this.dataPullIntid = setInterval(this.dataPull.bind(this), 1000)
            }
        } else {
            await this.comVal('w', 0, 0)
            clearInterval(this.dataPullIntid)
            this.dataPullIntid = undefined
            this.updateState()
        }
        this.updateButtons()
    }

    async dataPull() {
        if (this.running) {
            await this.updateState()
        } else if (this.dataPullIntid) {
            clearInterval(this.dataPullIntid)
            this.dataPullIntid = undefined
        }
    }

    async connectSer() {
        if (!("serial" in navigator)) {
            alert("The Web Serial API is not supported by your browser")
            return
        }

        const s = this.ser
        if(s.port) {
            await s.reader.cancel()
            return
        }
        
        s.port = await navigator.serial.requestPort()
        await s.port.open({baudRate: 115200})

        const textDecoder = new TextDecoderStream()
        const rStreamClosed = s.port.readable.pipeTo(textDecoder.writable)
        s.reader = textDecoder.readable.getReader()

        const textEncoder = new TextEncoderStream()
        const wStreamCloseed = textEncoder.readable.pipeTo(s.port.writable)
        s.writer = textEncoder.writable.getWriter()

        this.sel.conBtn.value = "Disconnect"
        this.sel.conStat.innerText = "Connected"
        setTimeout(this.initialSync.bind(this), 0)
        while (true) {
            const {value, done} = await this.ser.reader.read();
            if (done) {
                s.reader.releaseLock()
                break
            }
            if (value.includes('\n')) {
                let split = value.split('\n')
                const retVal = s.buff + split[0]
                s.buff = split[1]
                s?.recProm(retVal)
            } else {
                s.buff += value
            }
        }

        s.writer.close()
        await rStreamClosed.catch(() => {})
        await wStreamCloseed.catch(() => {})
        await s.port.close()
        s.port = undefined
        s.reader = undefined
        s.writer = undefined
        s.buff = ""
        s.recProm = undefined
        s.lock = false
        s.reqq = []

        this.sel.conBtn.value = "Connect"
        this.sel.conStat.innerText = "Disconneected"
    }

    async readLine() {
        return await new Promise((resolve, reject) => {
            this.ser.recProm = resolve
        })
    }

    async initialSync() {
        await this.sendBPs()
        await this.updateState()
    }

    async updateState() {
        this.running = await this.comVal('r', 0) == 1
        this.cpustate.reg = await this.comVal('r', 0x3000, 0x300F)
        this.cpustate.dmem = await this.comVal('r', 0x4000, 0x403F)
        let v = await this.comVal('r', 0x2000, 0x2002)
        this.cpustate.PC = v[0]
        this.cpustate.ZF = !!(v[1] & 1)
        this.cpustate.CF = !!(v[1] & 1 << 1)
        this.cpustate.intEn = !!(v[1] & 1 << 2)
        this.cpustate.intrq = !!(v[1] & 1 << 9)
        if(v[2] > 0) {
            this.cpustate.stack = await this.comVal('r', 0x2010, 0x2010 + v[2] - 1)    
        } else {
            this.cpustate.stack = []
        }
        
        this.updateUI()
        this.updateButtons()
    }

    async sendBPs() {
        let pbs = Array.from(this.breakPoints).sort((a, b) => a - b).slice(0, 4)
        const o = []
        for (let i = 0; i < pbs.length; i++) {
            o.push(pbs[i])
        }
        for (let i = pbs.length; i < 4; i++) {
            o.push(1 << 12)
        }
        this.comVal('w', 1, o)
    }

    async sendPmem() {
        let o = []
        for (let i = 0; i < 512; i++) {
            let v = 0
            for (let j = 0; j < 8; j++) {
                v |= ((this.cpustate.pmem[i * 8 + j] ?? 0) & 0x30000) >> 2 + j * 2
            }
            o.push(v)
        }
        await this.comVal('w', 0x6000, o)
        o = []
        for (let i = 0; i < 4096; i++) {
            o.push((this.cpustate.pmem[i] ?? 0) & 0xFFFF)
        }
        await this.comVal('w', 0x7000, o)
    }

    async getDevPmem() {
        const p = []
        const h = await this.comVal('r', 0x6000, 0x6000 + 511)
        for (let i = 0; i < h.length; i++) {
            for (let j = 0; j < 8; j++) {
                p.push(h[i] << (2 + j * 2) & 0x30000)
            }
        }
        const l = await this.comVal('r', 0x7000, 0x7FFF)
        for (let i = 0; i < l.length; i++) {
            p[i] |= l[i]
            if(p[i] === 0) {
                delete p[i]
            }
        }
        return p
    }
    
    async comVal(rw, start, end) {
        const s = this.ser
        if (s.lock) {
            await new Promise((resolve, reject) => {
                s.reqq.push(resolve)
            })
        } else {
            s.lock = true
            this.setUILinkState()
        }
        let retVal;
        if(rw === "r") {
            if(!end) {
                await s.writer.write(this.b2a(start) + '\r')
            } else {
                await s.writer.write(this.b2a([start, end]) + '\r')
            }
            retVal = this.a2b(await this.readLine())
        } else {
            if (!Array.isArray(end)) {
                end = [end]
            }
            await s.writer.write(this.b2a(start))
            let index = 0
            while (index < end.length) {
                await s.writer.write(":")
                for (let batind = 0; 
                    batind < 12 && index < end.length; 
                    index++, batind++) {
                        await s.writer.write(this.b2a(end[index]))
                }
                await s.writer.write('\r')
                await this.readLine()
            }
        }
        if (s.reqq.length) {
            s.reqq.shift()()
        } else {
            s.lock = false
            this.setUILinkState()
        }
        return retVal
    }

    b2a(v) {
        if(!Array.isArray(v)) {
            v = [v]
        }
        let o = ""
        for (let i = 0; i < v.length; i++) {
            o += ("000" + v[i].toString(16)).slice(-4)
        }
        return o
    }

    a2b(v) {
        const r = /([0-9A-Fa-f]).*?([0-9A-Fa-f]).*?([0-9A-Fa-f]).*?([0-9A-Fa-f]).*?/
        const out = []
        while (true) {
            const m = v.match(r)
            if (!m) {break}
            v = v.substring(m.index + m[0].length)
            out.push(parseInt(m.slice(1).join(''), 16))
        }
        return out
    }

    setUILinkState() {
        this.sel.actStat.innerText = this.ser.lock ? "Busy" : "Idle"
    }

    genUI() {
        const g = SimUI.htmlGen.bind(this)
        

        if(!this?.sel?.serConCont) {
            this.sel = {}
            super.genUI([
                g("div", {klass: "serConCont", after: e => this.sel.serConCont = e}, [
                    g("input", {type: "button", value: "Connect", event: this.connectSer, after: e => this.sel.conBtn = e}),
                    g("br"),
                    // g("input", {type: "button", value: "Load program from device", event: this.getDevPmem}),
                    g("input", {type: "button", value: "Program device", event: this.sendPmem}),
                    g("div", {}, [
                        g("span", {innerText: "Connection status: "}),
                        g("span", {innerText: "Disconnected",after: e => this.sel.conStat = e})
                    ]),
                    g("div", {}, [
                        g("span", {innerText: "Activity: "}),
                        g("span", {innerText: "Idle",after: e => this.sel.actStat = e})
                    ])
                ])
            ])

        } else {
            super.genUI([this.sel.serConCont])
        }

    }

    updateUI() {
        super.updateUI(this.cpustate)
    }
}
