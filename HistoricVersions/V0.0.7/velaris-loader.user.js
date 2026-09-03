// ==UserScript==
// @name         Velaris for Jellyfin V0.0.7 (Frozen)
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.0.7
// @description  Frozen Velaris V0.0.7 loader for Jellyfin Web.
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
    const COMMIT = '3c4159f2b47a1a8392aa0abdafbf11cf8bb07eaa';
    const base = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/`;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}velaris.css`;
    const js = document.createElement('script');
    js.src = `${base}velaris.js`;
    js.defer = true;
    (document.head || document.documentElement).append(css, js);
})();
