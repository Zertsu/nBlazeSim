"use strict";

let prog;
let simUI;

document.getElementById("compBtn").addEventListener("click" ,e => {
    prog = new Comp(document.getElementById("source").value)
    document.getElementById("bytecode").value = bytecodeToStr(prog.bytecode)
    simUI = new SimUI(document.getElementById("sim"), prog)
    document.getElementById("exportBtn").disabled = false
})
document.getElementById("exportBtn").addEventListener("click", async e => {
    let vhd = await vhdGen.genVHD(prog)
    vhdGen.downlaodFile("prog_memory.vhd", vhd)
})

function bytecodeToStr(c) {
    var o = ""
    for (let i = 0; i < c.length; i++) {      
        o += Comp.bytecode2bin(c[i]) + "\n"
    }
    return o
}
