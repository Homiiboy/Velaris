/** Velaris v0.0.8 bundle */
(() => {
    'use strict';

    if (window.__VELARIS_BUNDLE_V008__) return;
    window.__VELARIS_BUNDLE_V008__ = true;

    const VERSION = '0.0.8';
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@3c4159f2b47a1a8392aa0abdafbf11cf8bb07eaa/dist/velaris.js';
    const current = document.currentScript?.src || '';
    const PATCH_URL = current
        ? new URL('velaris-v008.js', current).href
        : 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris-v008.js?v=0.0.8';

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

    const baseReady = window.__VELARIS_BUNDLE_V007__
        ? Promise.resolve()
        : load(BASE_URL, 'velaris-base-v007');

    baseReady
        .then(() => window.__VELARIS_V008_PATCH__ ? undefined : load(PATCH_URL, 'velaris-patch-v008'))
        .then(() => {
            window.VelarisRelease = Object.freeze({
                version: VERSION,
                baseVersion: '0.0.7',
                searchVersion: window.VelarisSearch?.version || '0.0.7',
                settingsVersion: window.VelarisSettings?.version || VERSION
            });
            console.info(`[Velaris] v${VERSION} bundle active`);
        })
        .catch(error => console.error('[Velaris] V0.0.8 bundle failed to load.', error));
})();
