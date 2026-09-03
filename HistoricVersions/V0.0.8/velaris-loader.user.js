// ==UserScript==
// @name         Velaris for Jellyfin — V0.0.8
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.0.8
// @description  Frozen Velaris V0.0.8 loader.
// @match        http://*/web/*
// @match        https://*/web/*
// @match        http://*/jellyfin/*
// @match        https://*/jellyfin/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';
    const CSS = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@v0.0.8/dist/velaris.css';
    const JS = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@v0.0.8/dist/velaris.js';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS;
    (document.head || document.documentElement).appendChild(link);
    const script = document.createElement('script');
    script.src = JS;
    script.defer = true;
    (document.head || document.documentElement).appendChild(script);
})();
