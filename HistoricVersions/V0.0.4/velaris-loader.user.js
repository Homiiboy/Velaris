// ==UserScript==
// @name         Velaris for Jellyfin (Historic V0.0.4)
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.0.4
// @description  Frozen Velaris V0.0.4 loader for Jellyfin Web.
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
    const VERSION = '0.0.4';
    const COMMIT = '21ebae5b4afd7631f4e0492c242f9cc233f376bf';
    const CSS_URL = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/velaris.css`;
    const JS_URL = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/velaris.js`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    link.dataset.velarisVersion = VERSION;
    (document.head || document.documentElement).appendChild(link);
    const script = document.createElement('script');
    script.src = JS_URL;
    script.defer = true;
    script.dataset.velarisVersion = VERSION;
    (document.head || document.documentElement).appendChild(script);
})();
