"use strict";

let prog;
let simUI;

document.getElementById("compBtn").addEventListener("click" ,e => {
    const src = document.getElementById("source")
    prog = new Comp(src.value)
    document.getElementById("bytecode").value = bytecodeToStr(prog.bytecode)
    simUI = new SimUI(document.getElementById("sim"), prog, src)
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
