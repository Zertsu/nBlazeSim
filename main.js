"use strict";

let compUI;

document.addEventListener("DOMContentLoaded", function(event){
    const mainCont = document.getElementById("mainCont")
    document.getElementById("newCompBtn").addEventListener("click", e => {
        compUI = new CompUI(mainCont, locSimUI)
    })
    document.getElementById("connToHard").addEventListener("click", e => {
        compUI = new CompUI(mainCont, serSimUI, true)
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
});

function loadMng(txt) {
    const dat = JSON.parse(txt)
    if(dat?.nBlazeSimVer === 1) {
        compUI = new CompUI(mainCont, locSimUI)
        compUI.loadState(dat)
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
