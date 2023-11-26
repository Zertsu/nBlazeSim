"use strict";

class Comp {

    static defaultConstBase = 16
    constructor(code) {
        this.src = code
        this.#translateCode()
    }
    
    #tokenize(str) {
        const o = str.split(",")
        for (let i = 0; i < o.length; i++) {
            o[i] = o[i].trim()
        }
        return o
    }
    
    #parseConst(str) {
        const bases = {
            "0b": 2,
            "0o": 8,
            "0d": 10,
            "0x": 16
        }
        var base = bases[str.substring(0, 2)]
        if (base == undefined) {
            return parseInt(str, Comp.defaultConstBase)
        }
        return parseInt(str.substring(2), base)
    }
    
    #syorkk(args) {
        var o = 0
        o |= parseInt(args[0].substring(1)) << 8
        if (args[1][0] == 's') {
            o |= parseInt(args[1].substring(1)) << 4
        } else {
            o |= this.#parseConst(args[1]) | 1 << 12
        }
        return o
    }
    
    #handleT(opcode, str) {
        var o = opcode << 12
        const args = this.#tokenize(str)
        o |= this.#syorkk(args)
        return [o, null]
    }
    
    #handleSR(ext, str) {
        var o = 0b010100 << 12
        o |= parseInt(str.trim().substring(1)) << 8
        o |= ext
        return [o, null]
    }
    
    #handleJmp(type, str) {
        var o = 0b100000 << 12
        var jumpLab = null
        const args = this.#tokenize(str)
        switch (type) {
            case "jump":
                o |= 0b000010 << 12
            case "call":
                jumpLab = args[1]
                break
            case "return":
                if (args[0] == "") {
                    // Inconsistent case
                    o |= 0b000101 << 12
                    return [o, null]
                }
                o |= 0b000001
                break
            case "reti":
                o |= 0b001001
                o |= args[0] == "E" ? 1 : 0
                return [o, null]
            case "eni":
                o |= 0b000001
            case "disi":
                o |= 0b001000
                return [o, null]
            default:
                break
        }
    
        if (args.length == 1) {
            return [o, args[0]]
        }
    
        var cond = 0
        switch (args[0]) {
            case "Z":
                cond = 0b100
                break
            case "NZ":
                cond = 0b101
                break
            case "C":
                cond = 0b110
                break
            case "NC":
                cond = 0b111
                break
            default:
                break
        }
        o |= cond << 14
        return [o, args[1]]
    }
    
    #opCodes = {
        "LOAD"       : str => this.#handleT(0b000000, str),
        "INPUT"      : str => this.#handleT(0b001000, str),
        "FETCH"      : str => this.#handleT(0b001010, str),
        "OUTPUT"     : str => this.#handleT(0b101100, str),
        "STORE"      : str => this.#handleT(0b101110, str),
        "AND"        : str => this.#handleT(0b000010, str),
        "OR"         : str => this.#handleT(0b000100, str),
        "XOR"        : str => this.#handleT(0b000110, str),
        "MULT8"      : str => this.#handleT(0b001100, str),
        "COMP"       : str => this.#handleT(0b011100, str),
        "ADD"        : str => this.#handleT(0b010000, str),
        "ADDCY"      : str => this.#handleT(0b010010, str),
        "SUB"        : str => this.#handleT(0b011000, str),
        "SUBCY"      : str => this.#handleT(0b011010, str),
        "SR0"        : str => this.#handleSR(0b1110, str),
        "SR1"        : str => this.#handleSR(0b1111, str),
        "SRX"        : str => this.#handleSR(0b1010, str),
        "SRA"        : str => this.#handleSR(0b1000, str),
        "RR"         : str => this.#handleSR(0b1100, str),
        "SL0"        : str => this.#handleSR(0b0110, str),
        "SL1"        : str => this.#handleSR(0b0111, str),
        "SLX"        : str => this.#handleSR(0b0100, str),
        "SLA"        : str => this.#handleSR(0b0000, str),
        "RL"         : str => this.#handleSR(0b0010, str),
        "JUMP"       : str => this.#handleJmp("jump", str),
        "CALL"       : str => this.#handleJmp("call", str),
        "RETURN"     : str => this.#handleJmp("return", str),
        "RETURNI"    : str => this.#handleJmp("reti", str),
        "ENINTERR"   : str => this.#handleJmp("eni", str),
        "DISINTERRR" : str => this.#handleJmp("disi", str)
    }
    
    #translateCode() {
        let lines = this.src
            .replace("(", "")
            .replace(")", "")
            .replace(/(\/\/.*)\n/g, "")
            .replace(/([ \t]*\n[ \t]*)/gm, "\n")
            .split('\n')
        
        this.bytecode = []
        this.labels = {}
        this.jumpTarg = []
        this.addr2src = []
    
        let lableQ = []
        for (let i = 0; i < lines.length; i++) {
            const fullline = lines[i].split(";")
            for (let j = 0; j < fullline.length; j++) {
                const line = fullline[j];
                if (line === "") {continue}
                const lsplit = line.split(":")
                let comm
                if (lsplit.length > 1) {
                    lableQ.push(lsplit[0].trim())
                    comm = lsplit[1].trim()
                } else {
                    comm = line
                }
                if(comm === "") {
                    continue
                }
                comm = comm.split(" ")
                let inst, jtar
                [inst, jtar] = this.#opCodes[comm[0]](comm.slice(1).join(' '))
                this.jumpTarg[this.bytecode.length] = jtar
                while (lableQ.length) {
                    this.labels[lableQ.pop()] = this.bytecode.length
                }
                this.addr2src[this.bytecode.length] = i
                this.bytecode.push(inst)
            }
        }
        for (let i = 0; i < this.bytecode.length; i++) {
            if (this.jumpTarg[i] == null) {
                continue
            }
            this.bytecode[i] |= this.labels[this.jumpTarg[i]]
        }
    }
    }
