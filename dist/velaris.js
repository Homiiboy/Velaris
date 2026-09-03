/** Velaris v0.0.6 bundle */
(() => {
    'use strict';

    if (window.__VELARIS_BUNDLE_V006__) return;
    window.__VELARIS_BUNDLE_V006__ = true;

    const VERSION = '0.0.6';
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@203f92462bb3fc8e2b8b50d8daab3f63663df849/dist/velaris.js';
    const current = document.currentScript?.src || '';
    const PATCH_URL = current
        ? new URL('velaris-v006.js', current).href
        : 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris-v006.js?v=0.0.6';

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

    const baseReady = window.__VELARIS_V005__
        ? Promise.resolve()
        : load(BASE_URL, 'velaris-base-v005');

    baseReady
        .then(() => window.__VELARIS_V006_PATCH__ ? undefined : load(PATCH_URL, 'velaris-patch-v006'))
        .then(() => {
            window.VelarisRelease = Object.freeze({
                version: VERSION,
                baseVersion: window.Velaris?.version || '0.0.5',
                libraryVersion: window.VelarisLibrary?.version || VERSION
            });
            console.info(`[Velaris] v${VERSION} bundle active`);
        })
        .catch(error => console.error('[Velaris] V0.0.6 bundle failed to load.', error));
})();
