// ==UserScript==
// @name         Velaris for Jellyfin — Historic V0.0.6
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.0.6
// @description  Frozen Velaris V0.0.6 loader.
// @author       Homiiboy
// @match        http://*/web/*
// @match        https://*/web/*
// @match        http://*/jellyfin/*
// @match        https://*/jellyfin/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';
    const VERSION = '0.0.6';
    const COMMIT = 'aa9a97eabdeec61e90343dcc0feeb0f81b973632';
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/velaris.css`;
    css.dataset.velarisVersion = VERSION;
    (document.head || document.documentElement).appendChild(css);
    const js = document.createElement('script');
    js.defer = true;
    js.src = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/velaris.js`;
    js.dataset.velarisVersion = VERSION;
    (document.head || document.documentElement).appendChild(js);
})();
