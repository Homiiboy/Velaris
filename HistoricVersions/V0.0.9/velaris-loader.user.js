// ==UserScript==
// @name         Velaris for Jellyfin — V0.0.9 Historic
// @namespace    https://github.com/Homiiboy/Velaris
// @version      0.0.9
// @description  Frozen Velaris V0.0.9 loader.
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
  const base = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@v0.0.9';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = `${base}/dist/velaris.css`;
  (document.head || document.documentElement).appendChild(css);
  const js = document.createElement('script');
  js.src = `${base}/dist/velaris.js`;
  js.defer = true;
  (document.head || document.documentElement).appendChild(js);
})();
