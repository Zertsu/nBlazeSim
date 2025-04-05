"use strict";

class locSimKP6 {

    constructor(pmem, portCallback, options) {
        this.pmem = pmem
        this.port = portCallback
        this.dmem = new Uint8Array(options?.scratch_pad_memory_size ?? 64)
        this.stack = []
        this.reg = new Uint8Array(16)
        this.breg = new Uint8Array(16)
        this.actRB = false
        this.PC = 0
        this.ZF = false
        this.CF = false
        this.intEn = false
        this.intrq = false
        this.hwbuild = options?.hwbuild ?? 0
        this.interrupt_vector = options?.interrupt_vector ?? 0x3FF
    }

    reset() {
        this.dmem = new Uint8Array(this.dmem.length)
        this.stack = []
        this.reg = new Uint8Array(16)
        this.breg = new Uint8Array(16)
        this.actRB = false
        this.PC = 0
        this.ZF = false
        this.CF = false
        this.pout = []
        this.intEn = false
        this.intrq = false
    }

    setState(r, v) {
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
            return ["true", "1"].includes(v)
        }
        const rb = (v) => {
            v = v.toLowerCase()
            if (this.actRB !== (v === 'b')) {
                [this.reg, this.breg] = [this.breg, this.reg]
                this.actRB = !this.actRB
            }
        }
        switch (tar) {
            case "PC":    this.PC = parseInt(v)         ; break
            case "ZF":    this.ZF = b(v)                ; break
            case "CF":    this.CF = b(v)                ; break
            case "intEn": this.intEn = b(v)             ; break
            case "intRq": this.intrq = b(v)             ; break
            case "reg":   this.reg[ind] = parseInt(v)   ; break
            case "breg":  this.breg[ind] = parseInt(v)  ; break
            case "actRB": rb(v)                         ; break
            case "dmem":  this.dmem[ind] = parseInt(v)  ; break
            case "stack": 
                const stspl = v.split(" ")
                if (stspl.length === 1) {
                    this.stack[ind][0] = parseInt(v)
                    this.stack[ind][4] = false
                    break
                } else {
                    this.stack[ind][0] = parseInt(stspl[0])
                    if(stspl[1].length > 0) {
                        this.stack[ind][1] = stspl[1][0] === '1'
                        this.stack[ind][2] = stspl[1][1] === '1'
                        this.stack[ind][3] = stspl[1][2].toLowerCase() === 'b'
                    }
                    this.stack[ind][4] = true
                    break
                }
            default: break;
        }
    }
    
    loadState(s) {
        this.reg = new Uint8Array(s.reg)
        this.breg = new Uint8Array(s.breg)
        this.actRB = s.actRB
        this.dmem = new Uint8Array(s.dmem)
        this.stack = [...s.stack]
        this.PC = s.PC
        this.ZF = s.ZF
        this.CF = s.CF
        this.intEn = s.intEn
        this.intrq = s.intRq
    }

    saveState() {
        return {
            reg: Array.from(this.reg),
            breg: Array.from(this.breg),
            actRB: this.actRB,
            dmem: Array.from(this.dmem),
            stack: this.stack,
            PC: this.PC,
            ZF: this.ZF,
            CF: this.CF,
            intEn: this.intEn,
            intRq: this.intrq
        }
    }

    trigInt() {
        this.intrq = true
    }

    runCycle() {
        const s = this
        
        if (s.intEn && s.intrq) {
            s.intrq = false
            s.intEn = false
            s.stack.push([s.PC, s.ZF, s.CF, s.actRB, true])
            s.PC = s.interrupt_vector
            return
        }

        const inst = s.pmem[s.PC++]
        const instCode = inst >> 12
        const sX = inst >> 8 & 0xF
        const sY = inst >> 4 & 0xF
        const kk = inst & 0xFF
        const sa = inst & 0b11111111
        const aluext = inst & 0xF
        const addr = inst & 0b111111111111
        const intEn = inst & 1
        
        const updFlags = (t, trueVal) => {
            if (t.includes("z")) {
                s.ZF = s.reg[sX] == 0
            }
            if (t.includes("c")) {
                s.CF = s.reg[sX] != trueVal 
            }
        }
        const hanSR = (val, code) => {
            if ((inst & 0xFF) === 0x80) {
                s.CF = true
                s.ZF = s.hwbuild === 0
                return s.hwbuild
            }
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
            if(s.stack.length === 32) {
                s.reset()
                return 0
            }
            s.stack.push([s.PC - 1, s.ZF, s.CF, s.actRB, false])
            return addr
        }
        const hanRet = (int = false) => {
            if(s.stack.length === 0) {
                s.reset()
                return 0
            }
            const v = s.stack.pop()
            if(int) {
                s.ZF = v[1]
                s.CF = v[2]
                s.actRB = v[3]
                return v[0]
            }
            return v[0] + 1
        }
        const hanInt = () => {
            s.intEn = intEn == 1
        }
        const hanRegB = (v) => {
            if (s.actRB !== v) {
                [s.reg, s.breg] = [s.breg, s.reg]
                s.actRB = !s.actRB
            }
        }
        const getPar = (d, c) => {
            let p = 0
            while (d) {
                p ^= d & 1
                d >>= 1
            }
            return c ? p === 1 : p !== 1
        }
    
        switch (instCode) {
            // Register loading
            case 0b000001: s.reg[sX] = kk                       ; break // LOAD sX, kk
            case 0b000000: s.reg[sX] = s.reg[sY]                ; break // LOAD sX, sY
            case 0b010110: s.breg[sX] = s.reg[sY]               ; break // STAR sX, sY

            // Logical
            case 0b000011: updFlags("z" , s.reg[sX] &= kk                                       ); break // AND sX, kk
            case 0b000010: updFlags("z" , s.reg[sX] &= s.reg[sY]                                ); break // AND sX, sY
            case 0b000101: updFlags("z" , s.reg[sX] |= kk                                       ); break // OR sX, kk
            case 0b000100: updFlags("z" , s.reg[sX] |= s.reg[sY]                                ); break // OR sX, sY
            case 0b000111: updFlags("z" , s.reg[sX] ^= kk                                       ); break // XOR sX, kk
            case 0b000110: updFlags("z" , s.reg[sX] ^= s.reg[sY]                                ); break // XOR sX, sY

            // Arithmetic
            case 0b010001: updFlags("zc", s.reg[sX] += kk                                       ); break // ADD sX, kk
            case 0b010000: updFlags("zc", s.reg[sX] += s.reg[sY]                                ); break // ADD sX, sY
            case 0b010011: updFlags("zc", s.reg[sX] += kk + (s.CF ? 1 : 0)                      ); break // ADDCY sX, kk
            case 0b010010: updFlags("zc", s.reg[sX] += s.reg[sY] + (s.CF ? 1 : 0)               ); break // ADDCY sX, sY
            case 0b011001: updFlags("zc", s.reg[sX] -= kk                                       ); break // SUB sX, kk
            case 0b011000: updFlags("zc", s.reg[sX] -= s.reg[sY]                                ); break // SUB sX, sY
            case 0b011011: updFlags("zc", s.reg[sX] -= kk + (s.CF ? 1 : 0)                      ); break // SUBCY sX, kk
            case 0b011010: updFlags("zc", s.reg[sX] -= s.reg[sY] + (s.CF ? 1 : 0)               ); break // SUBCY sX, sY

            // Test and compare
            case 0b001100: s.ZF = (s.reg[sY] & s.reg[sX]) === 0; s.CF = getPar(s.reg[sY] & s.reg[sX])               ; break // TEST sX, sY
            case 0b001101: s.ZF = (kk & s.reg[sX]) === 0; s.CF = getPar(kk & s.reg[sX])                             ; break // TEST sX, kk
            case 0b001110: s.ZF = s.ZF && (s.reg[sY] & s.reg[sX]) === 0; s.CF = getPar(s.reg[sY] & s.reg[sX], s.CF) ; break // TESTCY sX, sY
            case 0b001110: s.ZF = s.ZF && (kk & s.reg[sX]) === 0; s.CF = getPar(kk & s.reg[sX], s.CF)               ; break // TESTCY sX, kk
            case 0b011100: s.CF = s.reg[sY] > s.reg[sX]; s.ZF = s.reg[sY] == s.reg[sX]                              ; break // COMP sX, sY
            case 0b011101: s.CF = kk > s.reg[sX]; s.ZF = kk == s.reg[sX]                                            ; break // COMP sX, kk
            case 0b011110: s.CF = s.reg[sY] + (s.CF ? 1 : 0) > s.reg[sX]; s.ZF = s.ZF && s.reg[sY] + (s.CF ? 1 : 0) == s.reg[sX] ; break // COMPCY sX, sY
            case 0b011111: s.CF = kk + (s.CF ? 1 : 0) > s.reg[sX]; s.ZF = s.ZF && s.reg[sY] + (s.CF ? 1 : 0) == s.reg[sX]        ; break // COMPCY sX, sY
            

            // Shift and rotate
            case 0b010100: s.reg[sX] = hanSR(s.reg[sX], aluext) ; break // SR and HWBUILD

            // Register bank selection
            case 0b110111: hanRegB(intEn === 1) ; break // REGBANK

            // Input and Output
            case 0b001001: s.reg[sX] = s.port("r", kk)          ; break // INPUT sX, PP
            case 0b001000: s.reg[sX] = s.port("r", s.reg[sY])   ; break // INPUT sX, (sY)
            case 0b101101: s.port("w", kk, s.reg[sX])           ; break // OUTPUT sX, PP
            case 0b101100: s.port("w", s.reg[sY], s.reg[sX])    ; break // OUTPUT sX, (sY)
            case 0b101011: s.port("w", inst & 0xF, (inst >> 4) & 0xFF) ; break // OUTPUTK kk, P

            // Scratch pad memory
            case 0b001011: s.reg[sX] = s.dmem[sa]               ; break // FETCH sX, sa
            case 0b001010: s.reg[sX] = s.dmem[s.reg[sY]]        ; break // FETCH sX, (sY)
            case 0b101111: s.dmem[sa] = s.reg[sX]               ; break // STORE sX, sa
            case 0b101110: s.dmem[s.reg[sY]] = s.reg[sX]        ; break // STORE sX, (sY)
    
            // Interrupt Handling
            case 0b101001: hanInt(); s.PC = hanRet(true)    ; break // RETURNI
            case 0b101000: hanInt()                         ; break // ENINTERR / DISINTERR

            // Jump
            case 0b100010: s.PC = addr                  ; break // JUMP addr
            case 0b110010: s.PC = s.ZF ? addr : s.PC    ; break // JUMP Z, addr
            case 0b110110: s.PC = s.ZF ? s.PC : addr    ; break // JUMP NZ, addr
            case 0b111010: s.PC = s.CF ? addr : s.PC    ; break // JUMP C, addr
            case 0b111110: s.PC = s.CF ? s.PC : addr    ; break // JUMP NC, addr
            case 0b100110: s.PC = ((s.reg[sX] | 0b1111) << 8) | s.reg[sY] ; break // JUMP@ (sX, sY)

            // Subroutines
            case 0b100000: s.PC = hanCall(addr)         ; break // CALL addr
            case 0b110000: s.PC = s.ZF ? hanCall(addr) : s.PC   ; break // CALL Z, addr
            case 0b110100: s.PC = s.ZF ? s.PC : hanCall(addr)   ; break // CALL NZ, addr
            case 0b111000: s.PC = s.CF ? hanCall(addr) : s.PC   ; break // CALL C, addr
            case 0b111100: s.PC = s.CF ? s.PC : hanCall(addr)   ; break // CALL NC, addr
            case 0b100100: s.PC = hanCall(((s.reg[sX] & 0b1111) << 8) | s.reg[sY])    ; break // CALL@ (sX, sY)
            case 0b100101: s.PC = hanRet()                  ; break // RETURN
            case 0b110001: s.PC = s.ZF ? hanRet() : s.PC    ; break // RETURN Z
            case 0b110101: s.PC = s.ZF ? s.PC : hanRet()    ; break // RETURN NZ
            case 0b111001: s.PC = s.CF ? hanRet() : s.PC    ; break // RETURN C
            case 0b111101: s.PC = s.CF ? s.PC : hanRet()    ; break // RETURN NC
            case 0b100001: s.reg[sX] = kk; s.PC = hanRet()  ; break // LOAD&RETURN sX, kk

            default: break;
        }
    }
}
