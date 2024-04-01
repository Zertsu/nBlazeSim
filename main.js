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
    // compUI = new CompUI(mainCont, locSimUI)
});
