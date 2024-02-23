"use strict";

let compUI;

document.addEventListener("DOMContentLoaded", function(event){
    const mainCont = document.getElementById("mainCont")
    document.getElementById("newCompBtn").addEventListener("click", e => {
        compUI = new CompUI(mainCont)
    })
    compUI = new CompUI(mainCont)
});
