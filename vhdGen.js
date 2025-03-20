"use strict";

class vhdGen {
    static #templateURL = "https://raw.githubusercontent.com/ptracton/Picoblaze/master/Picoblaze/ROM_form_templates/ROM_form_JTAGLoader_14March13.vhd"
    static #template = undefined

    static async #getTemplate() {
        const response = await fetch(this.#templateURL)
        const data = await response.text()
        this.#template = data
    }

    static #getDateString() {
        const mon = ["Jan", "Feb", "Mar", "Apr", 
            "May", "Jun", "Jul", "Aug",
            "Sep", "Oct", "Nov", "Dec"];

        const d = new Date()
        const off = d.getTimezoneOffset()
        const aOff = Math.abs(off)

        return  `${String(d.getDate()).padStart(2, "0")} ${mon[d.getMonth()]} ${d.getFullYear()} - ` +
                `${String(d.getHours()).padStart(2, "0")}:` +
                `${String(d.getMinutes()).padStart(2, "0")}:` + 
                `${String(d.getSeconds()).padStart(2, "0")} ` + 
                `${off <= 0 ? "+" : "-"}` + 
                `${String(Math.floor(aOff / 60)).padStart(2, "0")}` + 
                `${String(aOff % 60).padStart(2, "0")}`
    }

    static* #bytecodeReader(bytecode, index, msb, lsb) {
        while (true) {
            let v = (bytecode[index++] >> lsb) % (1 << (msb - lsb + 1))
            yield v === undefined ? 0 : v
        }
    }

    static #genLine(bytecode, startIndex, msb, lsb) {
        const w = msb - lsb + 1
        const instPerLine = 64 * 4 / w
        startIndex *= instPerLine
        const gen = this.#bytecodeReader(bytecode, startIndex, msb, lsb)
        let o = ""
        if (w >= 4) {
            // One instruction needs multiple digits
            const c = w / 4
            while (o.length != 64) {
                let q = gen.next().value
                for (let i = 0; i < c; i++) {
                    o = (q & 0xF).toString(16) + o
                    q >>= 4
                }
            }
        } else {
            // One digit contains multiple instructions
            const c = 4 / w
            while (o.length != 64) {
                let ch = 0
                for (let i = 0; i < c; i++) {
                    ch |= gen.next().value << i * w
                }
                o = ch.toString(16) + o
            }
        }
        return o.toUpperCase()
    }

    static async genVHD(prog) {
        if (vhdGen.#template == undefined) {
            await this.#getTemplate()
        }
        let o = vhdGen.#template.split("{begin template}").slice(-1)[0].trim()
        o = o.replaceAll("{psmname}", "<stdin>")
            .replaceAll("Generated by KCPSM6 Assembler", "Generated by nBlazeSim")
            .replaceAll("{timestamp}", this.#getDateString())
            .replaceAll("{name}", "prog_memory")

        o = o.replaceAll(/\{(\[(\d+):(\d+)\]_)?INIT(P)?_(.{2})\}/g, (m, c1, c2, c3, c4, c5) => {
            if (c4 == undefined) {
                if (c1 == undefined) {
                    return this.#genLine(prog.bytecode, parseInt(c5, 16), 15, 0)
                } else {
                    if(c2 == "8" && c3 == "0") {
                        return this.#genLine(prog.bytecode, parseInt(c5, 16), 7, 0)
                    } else if(c2 == "17" && c3 == "9") {
                        return this.#genLine(prog.bytecode, parseInt(c5, 16), 16, 9)
                    }
                    return "0".repeat(64)
                }
            } else {
                // Parity data
                if (c1 == undefined) {
                    return this.#genLine(prog.bytecode, parseInt(c5, 16), 17, 16)
                } else {
                    if(c2 == "8" && c3 == "0") {
                        return this.#genLine(prog.bytecode, parseInt(c5, 16), 8, 8)
                    } else if(c2 == "17" && c3 == "9") {
                        return this.#genLine(prog.bytecode, parseInt(c5, 16), 17, 17)
                    }
                    return "0".repeat(64)
                }
            }
        })
        return o
    }

    static downlaodFile(filename, data) {
        let a = document.createElement('a')
        a.href = 'data:attachment/text,' + encodeURI(data)
        a.target = '_blank'
        a.download = filename
        a.click();
    }

    static async getFile() {
        const filepicker = document.createElement("input")
        filepicker.setAttribute("type", "file")
        filepicker.click()
        return new Promise((resolve, reject) => {
            filepicker.addEventListener("change", e => {
                const reader = new FileReader()
                reader.addEventListener('load', file => resolve(file.target.result))
                reader.readAsText(e.target.files[0])
            });
        })
    }
}
