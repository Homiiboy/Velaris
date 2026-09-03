// ==UserScript==
// @name         Velaris for Jellyfin — V0.1.0
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.1.0
// @description  Frozen Velaris V0.1.0 loader.
// @match        http://*/web/*
// @match        https://*/web/*
// @match        http://*/jellyfin/*
// @match        https://*/jellyfin/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@v0.1.0/dist/velaris.css';
    (document.head || document.documentElement).appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@v0.1.0/dist/velaris.js';
    script.defer = true;
    (document.head || document.documentElement).appendChild(script);
})();
