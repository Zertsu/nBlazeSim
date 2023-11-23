"use strict";

var code;
// HTML Hooks

document.getElementById("compBtn").addEventListener("click" ,e => {
    let bytecode = translateCode(document.getElementById("source").value)
    document.getElementById("bytecode").value = bytecodeToStr(bytecode)
    code = bytecode.map(x => x[0])
})



// Helpers

function bytecodeToStr(c) {
    var o = ""
    for (let i = 0; i < c.length; i++) {
        const e = c[i][0];
        var n = e.toString(2);
        n = "000000000000000000".substr(n.length) + n;
        o += n + "\n"
    }
    return o
}

// Translator

var defaultConstBase = 16

function tokenize(str) {
    const o = str.split(",")
    for (let i = 0; i < o.length; i++) {
        o[i] = o[i].trim()
    }
    return o
}

function parseConst(str) {
    const bases = {
        "0b": 2,
        "0o": 8,
        "0d": 10,
        "0x": 16
    }
    var base = bases[str.substring(0, 2)]
    if (base == undefined) {
        return parseInt(str, defaultConstBase)
    }
    return parseInt(str.substring(2), base)
}


function syorkk(args) {
    var o = 0
    o |= parseInt(args[0].substring(1)) << 8
    if (args[1][0] == 's') {
        o |= parseInt(args[1].substring(1)) << 4
    } else {
        o |= parseConst(args[1]) | 1 << 12
    }
    return o
}

function handleT(opcode, str) {
    var o = opcode << 12
    const args = tokenize(str)
    o |= syorkk(args)
    return [o, null]
}

function handleSR(ext, str) {
    var o = 0b010100 << 12
    o |= parseInt(str.trim().substring(1)) << 8
    o |= ext
    return [o, null]
}

function handleJmp(type, str) {
    var o = 0b100000 << 12
    var jumpLab = null
    const args = tokenize(str)
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

const opCodes = {
    "LOAD"       : str => handleT(0b000000, str),
    "INPUT"      : str => handleT(0b001000, str),
    "FETCH"      : str => handleT(0b001010, str),
    "OUTPUT"     : str => handleT(0b101100, str),
    "STORE"      : str => handleT(0b101110, str),
    "AND"        : str => handleT(0b000010, str),
    "OR"         : str => handleT(0b000100, str),
    "XOR"        : str => handleT(0b000110, str),
    "MULT8"      : str => handleT(0b001100, str),
    "COMP"       : str => handleT(0b011100, str),
    "ADD"        : str => handleT(0b010000, str),
    "ADDCY"      : str => handleT(0b010010, str),
    "SUB"        : str => handleT(0b011000, str),
    "SUBCY"      : str => handleT(0b011010, str),
    "SR0"        : str => handleSR(0b1110, str),
    "SR1"        : str => handleSR(0b1111, str),
    "SRX"        : str => handleSR(0b1010, str),
    "SRA"        : str => handleSR(0b1000, str),
    "RR"         : str => handleSR(0b1100, str),
    "SL0"        : str => handleSR(0b0110, str),
    "SL1"        : str => handleSR(0b0111, str),
    "SLX"        : str => handleSR(0b0100, str),
    "SLA"        : str => handleSR(0b0000, str),
    "RL"         : str => handleSR(0b0010, str),
    "JUMP"       : str => handleJmp("jump", str),
    "CALL"       : str => handleJmp("call", str),
    "RETURN"     : str => handleJmp("return", str),
    "RETURNI"    : str => handleJmp("reti", str),
    "ENINTERR"   : str => handleJmp("eni", str),
    "DISINTERRR" : str => handleJmp("disi", str)
}


function translateCode(src) {
    var lines = src
        .trim()
        .replace(";", "\n")
        .replace("(", "")
        .replace(")", "")
        .replace(/([ \t]*\n[ \t]*)/gm, "\n")
        .replace(/(^\n)/gm, "")
        .replace(/(:\n)/gm, ": ")
        .split('\n')
    var o = []
    var olen = 0
    var labels = {}
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].split("//")[0]
        const lsplit = line.split(":")
        var comm
        if (lsplit.length > 1) {
            labels[lsplit[0].trim()] = i
            comm = lsplit[1].trim().split(" ")
        } else {
            comm = line.split(" ")
        }
        o[olen++] = opCodes[comm[0]](comm.slice(1).join(' '))
    }
    for (let i = 0; i < olen; i++) {
        if (o[i][1] == null) {
            continue
        }
        o[i][0] |= labels[o[i][1]]
    }
    return o
}


// Sim

class SimState {

constructor() {
    this.pmem = []
    this.dmem = new Uint16Array(64)
    this.stack = []
    this.reg = new Uint16Array(16)
    this.PC = 0
    this.ZF = false
    this.CF = false
    this.pin = []
    this.pout = []
}

runCycle() {
    const s = this
    const inst = s.pmem[s.PC++]
    const instCode = inst >> 12
    const sX = inst >> 8 & 0xF
    const sY = inst >> 4 & 0xF
    const kk = inst & 0xFF
    const sa = inst & 0b111111
    const aluext = inst & 0xF
    const addr = inst & 0b111111111111
    
    const ppush = (pID, data) => {
        if (s.pout[pID] == undefined) {
            s.pout[pID] = []
        }
        s.pout[pID].push(data)
    }
    const updFlags = (t, trueVal) => {
        if (t.includes("z")) {
            s.ZF = s.reg[sX] == 0
        }
        if (t.includes("c")) {
            s.CF = s.reg[sX] != trueVal 
        }
    }
    const hanSR = (val, code) => {
        const msb = 1 << 15
        const c = code & 0b111
        var oVal = val
        var oCF
        if (code & 0b1000) {
            // SRR
            oCF = (val & 1) == 1
            oVal >>= 1
            switch (c) {
                case 0b110:                               break // SR0
                case 0b111: oVal |= msb                 ; break // SR1
                case 0b010: oVal |= val & msb ? msb : 0 ; break // SRX
                case 0b000: oVal |= s.CF ? msb : 0      ; break // SRA
                case 0b100: oVal |= val & 1 ? msb : 0   ; break // RR
                default: break 
            }
        } else {
            // SRL
            oCF = !!(val & msb)
            oVal <<= 1
            switch (c) {
                case 0b110:                             ; break // SL0
                case 0b111: oVal |= 1                   ; break // SL1
                case 0b100: oVal |= val & 1             ; break // SLX
                case 0b000: oVal |= s.CF ? 1 : 0        ; break // SLA
                case 0b010: oVal |= val & msb ? 1 : 0   ; break // RL
                default: break
            }
            oVal &= 0xFFFF
        }
        s.ZF = val == 0
        s.CF = oCF
        return oVal
    }
    const hanCall = (addr) => {
        s.stack.push(s.PC)
        return addr
    }
    const hanRet = () => {
        return s.stack.pop()
    }

    switch (instCode) {
        // Data moving inst
        case 0b000001: s.reg[sX] = kk                   ; break // LOAD sX, kk
        case 0b000000: s.reg[sX] = s.reg[sY]            ; break // LOAD sX, sY
        case 0b001001: s.reg[sX] = s.pin[kk].shift()    ; break // INPUT sX, PP
        case 0b001000: s.reg[sX] = s.pin[sY].shift()    ; break // INPUT sX, (sY)
        case 0b001011: s.reg[sX] = s.dmem[sa]           ; break // FETCH sX, sa
        case 0b001010: s.reg[sX] = s.dmem[sY]           ; break // FETCH sX, (sY)
        case 0b101101: ppush(kk, s.reg[sX])             ; break // OUTPUT sX, PP
        case 0b101100: ppush(s.reg[sY], s.reg[sX])      ; break // OUTPUT sX, (sY)
        case 0b101111: s.dmem[sa] = s.reg[sX]           ; break // STORE sX, sa
        case 0b101110: s.dmem[sY] = s.reg[sX]           ; break // STORE sX, (sY)

        // Arith inst
        case 0b000011: updFlags("z" , s.reg[sX] &= kk                                       ); break // AND sX, kk
        case 0b000010: updFlags("z" , s.reg[sX] &= s.reg[sY]                                ); break // AND sX, sY
        case 0b000101: updFlags("z" , s.reg[sX] |= kk                                       ); break // OR sX, kk
        case 0b000100: updFlags("z" , s.reg[sX] |= s.reg[sY]                                ); break // OR sX, sY
        case 0b000111: updFlags("z" , s.reg[sX] ^= kk                                       ); break // XOR sX, kk
        case 0b000110: updFlags("z" , s.reg[sX] ^= s.reg[sY]                                ); break // XOR sX, sY
        case 0b001101: updFlags("zc", s.reg[sX] = (s.reg[sX] & 0xFF) * kk                   ); break // MULT8 sX, kk
        case 0b001100: updFlags("zc", s.reg[sX] = (s.reg[sX] & 0xFF) * (s.reg[sY] & 0xFF)   ); break // MULT8 sX, sY
        case 0b011101: s.CF = kk > s.reg[sX]; s.ZF = kk == s.reg[sX]                         ; break // COMP sX, kk
        case 0b011100: s.CF = s.reg[sY] > s.reg[sX]; s.ZF = s.reg[sY] == s.reg[sX]           ; break // COMP sX, sY
        case 0b010001: updFlags("zc", s.reg[sX] += kk                                       ); break // ADD sX, kk
        case 0b010000: updFlags("zc", s.reg[sX] += s.reg[sY]                                ); break // ADD sX, sY
        case 0b010011: updFlags("zc", s.reg[sX] += kk + s.CF ? 1 : 0                        ); break // ADDCY sX, kk
        case 0b010010: updFlags("zc", s.reg[sX] += s.reg[sY] + s.CF ? 1 : 0                 ); break // ADDCY sX, sY
        case 0b011001: updFlags("zc", s.reg[sX] -= kk                                       ); break // SUB sX, kk
        case 0b011000: updFlags("zc", s.reg[sX] -= s.reg[sY]                                ); break // SUB sX, sY
        case 0b011011: updFlags("zc", s.reg[sX] -= kk + s.CF                                ); break // SUBCY sX, kk
        case 0b011010: updFlags("zc", s.reg[sX] -= s.reg[sY] + s.CF                         ); break // SUBCY sX, sY
        case 0b010100: s.reg[sX] = hanSR(s.reg[sX], aluext)                                  ; break // SR

        // Branching inst
        case 0b100010: s.PC = addr                  ; break // JUMP addr
        case 0b110010: s.PC = s.ZF ? addr : s.PC    ; break // JUMP Z, addr
        case 0b110110: s.PC = s.ZF ? s.PC : addr    ; break // JUMP NZ, addr
        case 0b111010: s.PC = s.CF ? addr : s.PC    ; break // JUMP C, addr
        case 0b111110: s.PC = s.CF ? s.PC : addr    ; break // JUMP NC, addr
        case 0b100000: s.PC = hanCall(addr)         ; break // CALL addr
        case 0b110000: s.PC = s.ZF ? hanCall(addr) : s.PC   ; break // CALL Z, addr
        case 0b110100: s.PC = s.ZF ? s.PC : hanCall(addr)   ; break // CALL NZ, addr
        case 0b111000: s.PC = s.CF ? hanCall(addr) : s.PC   ; break // CALL C, addr
        case 0b111100: s.PC = s.CF ? s.PC : hanCall(addr)   ; break // CALL NC, addr
        case 0b100101: s.PC = hanRet()                  ; break // RETURN
        case 0b110001: s.PC = s.ZF ? hanRet() : s.PC    ; break // RETURN Z
        case 0b110101: s.PC = s.ZF ? s.PC : hanRet()    ; break // RETURN NZ
        case 0b111001: s.PC = s.CF ? hanRet() : s.PC    ; break // RETURN C
        case 0b111101: s.PC = s.CF ? s.PC : hanRet()    ; break // RETURN NC
        default: break;
    }
}

}
