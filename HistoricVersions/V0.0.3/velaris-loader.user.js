// ==UserScript==
// @name         Velaris for Jellyfin
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.0.3
// @description  Loads the Velaris CSS and JavaScript enhancement layer into Jellyfin Web.
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
    const VERSION = '0.0.3';
    const PINNED_COMMIT = '7cd3eec5592ff453dd036051d8f9938371dba35a';
    const CSS_URL = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${PINNED_COMMIT}/dist/velaris.css`;
    const JS_URL = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${PINNED_COMMIT}/dist/velaris.js`;
    const load = () => {
        if (!document.getElementById('velaris-userscript-css')) {
            const link = document.createElement('link');
            link.id = 'velaris-userscript-css';
            link.rel = 'stylesheet';
            link.href = CSS_URL;
            document.head.appendChild(link);
        }
        if (!document.getElementById('velaris-userscript-js')) {
            const script = document.createElement('script');
            script.id = 'velaris-userscript-js';
            script.src = JS_URL;
            script.defer = true;
            script.dataset.velarisVersion = VERSION;
            document.head.appendChild(script);
        }
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', load, { once: true }) : load();
})();
