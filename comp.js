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
        if (this.regNames[args[0]] != undefined) {
            o |= this.regNames[args[0]] << 8
        } else {
            o |= parseInt(args[0].substring(1), 16) << 8
        }

        if (this.regNames[args[1]] != undefined) {
            o |= this.regNames[args[1]] << 4
        } else if(args[1][0] == 's') {
            o |= parseInt(args[1].substring(1), 16) << 4
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
        const reg = str.trim()
        if (this.regNames[reg]) {
            o |= this.regNames[reg] << 8
        } else {
            o |= parseInt(reg.substring(1)) << 8
        }
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
                o |= 0b000001 << 12
                break
            case "reti":
                o |= 0b001001 << 12
                o |= args[0] == "E" ? 1 : 0
                return [o, null]
            case "eni":
                o |= 1
            case "disi":
                o |= 0b001000 << 12
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
        "DISINTERR"  : str => this.#handleJmp("disi", str)
    }

    #dirs = {
        "NAMEREG" : str => {
            const args = this.#tokenize(str)
            this.regNames[args[1]] = parseInt(args[0].substring(1))
        },
        "ADDRESS" : str => {
            this.bytecodeIndex = this.#parseConst(str.trim())
        }
    }
    
    #translateCode() {
        let lines = this.src
            .replaceAll("(", "")
            .replaceAll(")", "")
            .replaceAll(/(\/\/.*)\n/g, "")
            .replaceAll(/( *; *)/g, ";")
            .replaceAll(/([ \t]*\n[ \t]*)/gm, "\n")
            .split('\n')
        
        this.bytecode = []
        this.labels = {}
        this.jumpTarg = []
        this.addr2src = []
        this.regNames = {}

        let lableQ = []
        this.bytecodeIndex = 0;
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
                    comm = line.trim()
                }
                if(comm === "") {
                    continue
                }
                comm = comm.split(" ")
                if (this.#dirs[comm[0].toUpperCase()] != undefined) {
                    this.#dirs[comm[0].toUpperCase()](comm.slice(1).join(' '))
                    continue
                }
                let inst, jtar
                [inst, jtar] = this.#opCodes[comm[0].toUpperCase()](comm.slice(1).join(' '))
                this.jumpTarg[this.bytecodeIndex] = jtar
                while (lableQ.length) {
                    this.labels[lableQ.pop()] = this.bytecodeIndex
                }
                this.addr2src[this.bytecodeIndex] = i
                this.bytecode[this.bytecodeIndex++] = inst
            }
        }
        for (let i = 0; i < this.bytecode.length; i++) {
            if (this.jumpTarg[i] == null) {
                continue
            }
            this.bytecode[i] |= this.labels[this.jumpTarg[i]]
        }
        this.lineLabels = {}
        for (const key in this.labels) {
            this.lineLabels[this.labels[key]] = key
        }
        this.bytecodeIndex = undefined
    }

    static bytecode2bin(code) {
        if (code == undefined) {
            code = 0
        }
        let n = code.toString(2);
        n = "000000000000000000".substring(n.length) + n;
        return n
    }

    #rOpCodes = {
        0b000001: "LOAD sX, kk",
        0b000000: "LOAD sX, sY",
        0b001001: "INPUT sX, PP",
        0b001000: "INPUT sX, (sY)",
        0b001011: "FETCH sX, sa",
        0b001010: "FETCH sX, (sY)",
        0b101101: "OUTPUT sX, PP",
        0b101100: "OUTPUT sX, (sY)",
        0b101111: "STORE sX, sa",
        0b101110: "STORE sX, (sY)",
        0b000011: "AND sX, kk",
        0b000010: "AND sX, sY",
        0b000101: "OR sX, kk",
        0b000100: "OR sX, sY",
        0b000111: "XOR sX, kk",
        0b000110: "XOR sX, sY",
        0b001101: "MULT8 sX, kk",
        0b001100: "MULT8 sX, sY",
        0b011101: "COMP sX, kk",
        0b011100: "COMP sX, sY",
        0b010001: "ADD sX, kk",
        0b010000: "ADD sX, sY",
        0b010011: "ADDCY sX, kk",
        0b010010: "ADDCY sX, sY",
        0b011001: "SUB sX, kk",
        0b011000: "SUB sX, sY",
        0b011011: "SUBCY sX, kk",
        0b011010: "SUBCY sX, sY",
        0b010100: "SR",
        0b100010: "JUMP addr",
        0b110010: "JUMP Z, addr",
        0b110110: "JUMP NZ, addr",
        0b111010: "JUMP C, addr",
        0b111110: "JUMP NC, addr",
        0b100000: "CALL addr",
        0b110000: "CALL Z, addr",
        0b110100: "CALL NZ, addr",
        0b111000: "CALL C, addr",
        0b111100: "CALL NC, addr",
        0b100101: "RETURN",
        0b110001: "RETURN Z",
        0b110101: "RETURN NZ",
        0b111001: "RETURN C",
        0b111101: "RETURN NC",
        0b101001: "RETURNI",
        0b101000: "INTERR"
    }

    bytecode2str(code) {
        let txt = this.#rOpCodes[code >> 12]
        const sX = code >> 8 & 0xF
        const sY = code >> 4 & 0xF
        const kk = code & 0xFF
        const sa = code & 0b111111
        const aluext = code & 0xF
        const addr = code & 0b111111111111
        const intEN = code & 1
        const label = this.lineLabels[addr]
        switch (txt) {
            case "SR":
                const c = aluext & 0b111
                if (aluext & 0b1000) {
                    // SRR
                    switch (c) {
                        case 0b110: txt = "SR0" ; break
                        case 0b111: txt = "SR1" ; break
                        case 0b010: txt = "SRX" ; break
                        case 0b000: txt = "SRA" ; break
                        case 0b100: txt = "RR"  ; break
                        default: break 
                    }
                } else {
                    // SRL
                    switch (c) {
                        case 0b110:txt = "SL0"; break
                        case 0b111:txt = "SL1"; break
                        case 0b100:txt = "SLX"; break
                        case 0b000:txt = "SLA"; break
                        case 0b010:txt = "RL" ; break
                        default: break
                    }
                }
                txt += " sX"
                break
            case "RETURNI":
                txt += intEN == 1 ? " E" : " D"
                break
            case "INTERR":
                txt = intEN == 1 ? "INTERR" : "DISINTERR"
                break
            default: break
        }

        txt = txt
            .replace("sX", "s" + sX)
            .replace("sY", "s" + sY)
            .replace("kk", kk)
            .replace("PP", kk)
            .replace("sa", sa)
            .replace("addr", label ? label : addr)
        return txt
    }
}
