"use strict";

var prog;
var sim;
var simUI;

document.getElementById("compBtn").addEventListener("click" ,e => {
    prog = new Comp(document.getElementById("source").value)
    document.getElementById("bytecode").value = bytecodeToStr(prog.bytecode)
    sim = new Sim()
    sim.pmem = prog.bytecode
    genSim(prog)
    updateSimUI(sim)
})



document.getElementById("stepBtn").addEventListener("click", e => {
    sim.runCycle()
    updateSimUI(sim)
})
document.getElementById("step10Btn").addEventListener("click", e =>{
    let count = 0
    autoRunHan(true)
    simUI.interID = setInterval(() => {
        sim.runCycle()
        updateSimUI(sim)
        if (++count == 10) {
            clearInterval(simUI.interID)
            autoRunHan(false)
        }
    }, 50);
})
document.getElementById("runBtn").addEventListener("click", e => {
    autoRunHan(true)
    simUI.interID = setInterval(() => {
        sim.runCycle()
        updateSimUI(sim)
        if (simUI.lastPC == sim.PC) {
            clearInterval(simUI.interID)
            autoRunHan(false)
        }
        simUI.lastPC = sim.PC
    }, 50);
})
document.getElementById("stopBtn").addEventListener("click", e => {
    clearInterval(simUI.interID)
    autoRunHan(false)
})
document.getElementById("intBtn").addEventListener("click", e => {
    sim.trigInt()
    sim.runCycle()
    sim.disInt()
    updateSimUI(sim)
})
document.getElementById("resetBtn").addEventListener("click", e => {
    if (simUI.interID) {
        clearInterval(simUI.interID)
    }
    sim.reset()
    autoRunHan(false)
    updateSimUI(sim)
})

function autoRunHan(s) {
    const b = simUI.btn
    b.stepBtn.disabled = s
    b.step10Btn.disabled = s
    b.runBtn.disabled = s
    b.stopBtn.disabled = !s
}


function bytecodeToStr(c) {
    var o = ""
    for (let i = 0; i < c.length; i++) {      
        o += Comp.bytecode2bin(c[i]) + "\n"
    }
    return o
}


function updateSimUI(s) {
    for (let i = 0; i < s.reg.length; i++) {
        simUI.reg[i].innerText = s.reg[i]
    }
    for (let i = 0; i < s.stack.length; i++) {
        const el = simUI.stack[i]
        el.innerText = s.stack[i]
        el.parentElement.style = "display: block"
    }
    for (let i = s.stack.length; i < 32; i++) {
        simUI.stack[i].parentElement.style = "display: none"
    }
    for (let i = 0; i < s.dmem.length; i++) {
        simUI.dmem[i].innerText = s.dmem[i]
    }

    simUI.PC.innerText = sim.PC
    simUI.ZF.innerText = sim.ZF
    simUI.CF.innerText = sim.CF
    simUI.intEn.innerText = sim.intEn
    simUI.btn.intBtn.disabled = ! sim.intEn

    const pmem = document.getElementById("pmem")
    disableClass(pmem, "active")
    simUI.pmem[sim.PC].parentElement.classList.add("active")

}

function disableClass(parent, tag) {
    for (const el of parent.getElementsByClassName(tag)) {
        el.classList.remove(tag)
    }
}

function genSim(p) {
    simUI = {}
    const dmem = document.getElementById("dmem")
    dmem.innerHTML = ''
    simUI.dmem = []
    for (let i = 0; i < 64; i++) {
        const c = genCell(i, "d" + i, 0)
        dmem.appendChild(c)
        simUI.dmem.push(c.lastChild)
    }
    simUI.reg = []
    const reg = document.getElementById("reg")
    reg.innerHTML = ''
    for (let i = 0; i < 16; i++) {
        const c = genCell("s" + i, "s" + i, 0)
        reg.appendChild(c)
        simUI.reg.push(c.lastChild)
    }
    const spec = document.getElementById("spec")
    spec.innerHTML = ''
    for (const e of ["PC", "ZF", "CF", "intEn"]) {
        const c = genCell(e, e, 0)
        spec.appendChild(c)
        simUI[e] = c.lastChild
    }
    simUI.stack = []
    const stack = document.getElementById("stack")
    stack.innerHTML = ''
    for (let i = 0; i < 32; i++) {
        const c = genCell(i, "cs" + i, 0)
        stack.appendChild(c)
        simUI.stack[i] = c.lastChild
    }
    const pmem = document.getElementById("pmem")
    pmem.innerHTML = ''
    simUI.pmem = []
    var nempty = 0;
    for (let i = 0; i < p.bytecode.length; i++) {
        if (p.bytecode[i] == undefined) {
            nempty++
            continue
        }
        if (nempty > 0) {
            const c = document.createElement("div")
            c.classList.add("cell")
            c.classList.add("dmemempty")
            c.innerText = nempty + " empty addresses"
            pmem.appendChild(c)
            nempty = 0
        }
        const c = genCell(
            p.lineLabels[i] == undefined ? i : i + " " + p.lineLabels[i], 
            "p" + i, 
            prog.bytecode2str(p.bytecode[i]))
        pmem.appendChild(c)
        simUI.pmem[i] = c.lastChild
    }
    simUI.btn = {}
    for (const b of ["stepBtn", "step10Btn", "runBtn", "stopBtn", "intBtn"]) {
        simUI.btn[b] = document.getElementById(b)
    }
    document.getElementById("sim").style = ""
}

function genCell(name, id, value) {
    const o = document.createElement("div")
    o.id = id
    o.className = "cell"
    const lab = document.createElement("div")
    lab.innerText = name
    o.appendChild(lab)
    const val = document.createElement("div")
    val.id = id + 'v'
    val.innerText = value
    o.appendChild(val)
    return o
}
