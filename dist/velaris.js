/** Velaris v0.0.7 bundle */
(() => {
    'use strict';

    if (window.__VELARIS_BUNDLE_V007__) return;
    window.__VELARIS_BUNDLE_V007__ = true;

    const VERSION = '0.0.7';
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@aa9a97eabdeec61e90343dcc0feeb0f81b973632/dist/velaris.js';
    const current = document.currentScript?.src || '';
    const PATCH_URL = current
        ? new URL('velaris-v007.js', current).href
        : 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris-v007.js?v=0.0.7';

    const load = (src, id) => new Promise((resolve, reject) => {
        if (id && document.getElementById(id)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        if (id) script.id = id;
        script.src = src;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        (document.head || document.documentElement).appendChild(script);
    });

    const baseReady = window.__VELARIS_BUNDLE_V006__
        ? Promise.resolve()
        : load(BASE_URL, 'velaris-base-v006');

    baseReady
        .then(() => window.__VELARIS_V007_PATCH__ ? undefined : load(PATCH_URL, 'velaris-patch-v007'))
        .then(() => {
            window.VelarisRelease = Object.freeze({
                version: VERSION,
                baseVersion: '0.0.6',
                searchVersion: window.VelarisSearch?.version || VERSION
            });
            console.info(`[Velaris] v${VERSION} bundle active`);
        })
        .catch(error => console.error('[Velaris] V0.0.7 bundle failed to load.', error));
})();
