"use strict";

class Sim {

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
        this.intEn = true
        this.intrq = false
    }

    reset() {
        this.dmem = new Uint16Array(64)
        this.stack = []
        this.reg = new Uint16Array(16)
        this.PC = 0
        this.ZF = false
        this.CF = false
        this.pout = []
        this.intEn = true
        this.intrq = false
    }
    
    trigInt() {
        this.intrq = true
    }

    disInt() {
        this.intrq = false
    }

    runCycle() {
        const s = this
        
        if (s.intEn && s.intrq) {
            s.stack.push(s.PC)
            s.PC = 0x3FF
            return
        }

        const inst = s.pmem[s.PC++]
        const instCode = inst >> 12
        const sX = inst >> 8 & 0xF
        const sY = inst >> 4 & 0xF
        const kk = inst & 0xFF
        const sa = inst & 0b111111
        const aluext = inst & 0xF
        const addr = inst & 0b111111111111
        const intEn = inst & 1
        
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
        const hanInt = () => {
            s.intEn = intEn == 1
        }
    
        switch (instCode) {
            // Data moving inst
            case 0b000001: s.reg[sX] = kk                       ; break // LOAD sX, kk
            case 0b000000: s.reg[sX] = s.reg[sY]                ; break // LOAD sX, sY
            case 0b001001: s.reg[sX] = s.pin[kk].shift()        ; break // INPUT sX, PP
            case 0b001000: s.reg[sX] = s.pin[s.reg[sY]].shift() ; break // INPUT sX, (sY)
            case 0b001011: s.reg[sX] = s.dmem[sa]               ; break // FETCH sX, sa
            case 0b001010: s.reg[sX] = s.dmem[s.reg[sY]]        ; break // FETCH sX, (sY)
            case 0b101101: ppush(kk, s.reg[sX])                 ; break // OUTPUT sX, PP
            case 0b101100: ppush(s.reg[sY], s.reg[sX])          ; break // OUTPUT sX, (sY)
            case 0b101111: s.dmem[sa] = s.reg[sX]               ; break // STORE sX, sa
            case 0b101110: s.dmem[s.reg[sY]] = s.reg[sX]        ; break // STORE sX, (sY)
    
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
            case 0b010011: updFlags("zc", s.reg[sX] += kk + (s.CF ? 1 : 0)                      ); break // ADDCY sX, kk
            case 0b010010: updFlags("zc", s.reg[sX] += s.reg[sY] + (s.CF ? 1 : 0)               ); break // ADDCY sX, sY
            case 0b011001: updFlags("zc", s.reg[sX] -= kk                                       ); break // SUB sX, kk
            case 0b011000: updFlags("zc", s.reg[sX] -= s.reg[sY]                                ); break // SUB sX, sY
            case 0b011011: updFlags("zc", s.reg[sX] -= kk + (s.CF ? 1 : 0)                      ); break // SUBCY sX, kk
            case 0b011010: updFlags("zc", s.reg[sX] -= s.reg[sY] + (s.CF ? 1 : 0)               ); break // SUBCY sX, sY
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
            case 0b101001: hanInt(); s.PC = hanRet()        ; break // RETURNI
            case 0b101000: hanInt()                         ; break // ENINTERR / DISINTERR
            default: break;
        }
    }
}
