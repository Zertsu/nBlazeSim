"use strict";

var prog;
var sim;

document.getElementById("compBtn").addEventListener("click" ,e => {
    prog = new Comp(document.getElementById("source").value)
    document.getElementById("bytecode").value = bytecodeToStr(prog.bytecode)
})


function bytecodeToStr(c) {
    var o = ""
    for (let i = 0; i < c.length; i++) {
        const e = c[i];
        var n = e.toString(2);
        n = "000000000000000000".substr(n.length) + n;
        o += n + "\n"
    }
    return o
}
