"use strict";

const compUIList = [];
const closeHandler = c => compUIList.splice(compUIList.indexOf(c), 1)

document.addEventListener("DOMContentLoaded", function(event){
    const mainCont = document.getElementById("mainCont")
    document.getElementById("archSelect").addEventListener("change", e => {
        document.querySelector(".archoptions.active").classList.remove("active")
        document.getElementById(`${e.target.value}options`).classList.add("active")
    })
    document.getElementById("newCompBtn").addEventListener("click", e => {
        const arch = document.getElementById("archSelect").value
        const options = {}
        document.querySelectorAll(`#${arch}options [name]`).forEach(v => {
            const k = v.id.slice(v.id.indexOf("_") + 1)
            switch (v.dataset.parse) {
                case "int":
                    options[k] = parseInt(v.value)
                    break;
                default:
                    options[k] = v.value
                    break;
            }
        })
        switch (arch) {
            case "nblaze":
                compUIList.push(new CompUI(mainCont, Comp, locSimUI, options, false, closeHandler))
                break;
            case "kp6":
                compUIList.push(new CompUI(mainCont, CompKP6, locSimUIKP6, options, false, closeHandler))
            default:
                break;
        }
    })
    document.getElementById("connToHard").addEventListener("click", e => {
        new CompUI(mainCont, Comp, serSimUI, null, true)
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
    if (toLoad?.nBlazeSimVer === undefined) {
        return
    }
    if(toLoad?.nBlazeSimVer === 2) {
        const arch = {
            nblaze: [Comp, locSimUI],
            kp6: [CompKP6, locSimUIKP6]
        }[toLoad.arch]
            const c = new CompUI(mainCont, arch[0], arch[1], toLoad.archopts, false, closeHandler)
            compUIList.push(c)
            c.loadState(toLoad)
    } else {
        loadMng(saveConverter.update(toLoad, 2))
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
