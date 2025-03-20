"use strict";

const compUIList = [];
const closeHandler = c => compUIList.splice(compUIList.indexOf(c), 1)

document.addEventListener("DOMContentLoaded", function(event){
    const mainCont = document.getElementById("mainCont")
    document.getElementById("newCompBtn").addEventListener("click", e => {
        compUIList.push(new CompUI(mainCont, locSimUI, false, closeHandler))
    })
    document.getElementById("connToHard").addEventListener("click", e => {
        new CompUI(mainCont, serSimUI, true)
    })
    document.getElementById("loadBtn").addEventListener("click",async e => {
        loadMng(await vhdGen.getFile())
    })
    document.getElementById("exampleSelect").addEventListener("change", async e => {
        const response = await fetch("examples/" + e.target.value)
        const data = await response.text()
        loadMng(data)
        e.target.value = "default"
    })
    // compUI = new CompUI(mainCont, locSimUI)
    
    window.addEventListener("drop", dropHandler)
    window.addEventListener("dragover", e => {
        e.preventDefault();
    });

    window.addEventListener("beforeunload", e => {
        const states = JSON.parse(localStorage.getItem("procs")) ?? []
        for (const cui of compUIList) {
            states.push(cui.saveState())
        }
        localStorage.setItem("procs", JSON.stringify(states))
    })

    const prevState = localStorage.getItem("procs")
    if (prevState !== null) {
        loadMng(prevState)
        localStorage.removeItem("procs")
    }
});

function loadMng(toLoad) {
    if (typeof toLoad === "string") {
        toLoad = JSON.parse(toLoad)
    }
    if (Array.isArray(toLoad)) {
        for (const el of toLoad) {
            loadMng(el)
        }
        return
    }
    if(toLoad?.nBlazeSimVer === 1) {
        const c = new CompUI(mainCont, locSimUI, false, closeHandler)
        compUIList.push(c)
        c.loadState(toLoad)
    }
}


async function dropHandler(e) {
    e.preventDefault();
    const files = []
    if (e.dataTransfer.items) {
        for (const item of [...e.dataTransfer.items]) {
            if (item.kind === "file") {
                files.push(item.getAsFile())
            }   
        }
    } else {
        for (const file of [...e.dataTransfer.files]) {
            files.push(file)
        }
    }
    for (const f of files) {
        loadMng(await f.text())
    }
}
