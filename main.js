"use strict";


// HTML Hooks

document.getElementById("compBtn").addEventListener("click" ,e => {
    document.getElementById("bytecode").value = bytecodeToStr(translateCode(document.getElementById("source").value))
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
