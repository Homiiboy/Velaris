// ==UserScript==
// @name         Velaris for Jellyfin
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.1.0
// @description  Loads the Velaris CSS and JavaScript enhancement layer into Jellyfin Web.
// @author       Homiiboy
// @match        http://*/web/*
// @match        https://*/web/*
// @match        http://*/jellyfin/*
// @match        https://*/jellyfin/*
// @updateURL    https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    const VERSION = '0.1.0';
    const COMMIT = '3b9895ae3ce86c5ee19ea74929b35eaf498a45aa';
    const CSS_URL = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/velaris.css`;
    const JS_URL = `https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@${COMMIT}/dist/velaris.js`;
    const CSS_ID = 'velaris-userscript-css';
    const JS_ID = 'velaris-userscript-js';

    const looksLikeJellyfin = () => {
        const path = location.pathname.toLowerCase();
        if (path.includes('/web/') || path.includes('/jellyfin/')) return true;
        return Boolean(document.querySelector('.skinHeader, .mainDrawer, .homePage, [data-role="page"]') || window.ApiClient || window.Emby);
    };

    const injectCss = () => {
        const old = document.getElementById(CSS_ID);
        if (old?.dataset.velarisVersion === VERSION) return;
        old?.remove();
        const link = document.createElement('link');
        link.id = CSS_ID;
        link.rel = 'stylesheet';
        link.href = CSS_URL;
        link.dataset.velarisVersion = VERSION;
        (document.head || document.documentElement).appendChild(link);
    };

    const injectJs = () => {
        const old = document.getElementById(JS_ID);
        if (old?.dataset.velarisVersion === VERSION) return;
        old?.remove();
        const script = document.createElement('script');
        script.id = JS_ID;
        script.src = JS_URL;
        script.defer = true;
        script.dataset.velarisVersion = VERSION;
        script.onload = () => console.info(`[Velaris Loader] V${VERSION} loaded.`);
        script.onerror = () => console.error('[Velaris Loader] Failed to load Velaris JavaScript.');
        (document.head || document.documentElement).appendChild(script);
    };

    const boot = () => {
        if (!looksLikeJellyfin()) return;
        injectCss();
        injectJs();
    };

    boot();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
